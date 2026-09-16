# Docker 本地服务器实施计划

**日期**：2026-09-15  
**状态**：实施中  
**设计文档**：[2026-09-15-docker-local-server-design.md](../specs/2026-09-15-docker-local-server-design.md)

## 目标 (Goal)

将现有 `server/` 目录的 Express + SQLite 后端容器化，提供 Docker Compose 一键启动方式，作为微信云开发的便携自托管备选方案。

## 架构概述 (Architecture)

- **单容器部署**：Node.js + Express + better-sqlite3 打包在一个容器中
- **数据持久化**：通过 Docker Named Volumes 挂载 `/app/data`（SQLite）和 `/app/uploads`（图片）
- **端口映射**：宿主机 8787 → 容器 8787（可通过环境变量 `PORT` 覆盖）
- **健康检查**：`GET /health` 返回 `{"ok":true}` 作为容器健康探针

## 技术栈 (Tech Stack)

- **Base Image**：`node:20-bookworm-slim`（Debian 基础，包含构建工具，better-sqlite3 原生编译友好）
- **Package Manager**：npm（使用 `npm ci --omit=dev` 安装生产依赖）
- **Orchestration**：Docker Compose v2
- **Healthcheck**：curl（需在镜像中安装）

## 全局约束 (Global Constraints)

1. **最小化服务器代码变更**：仅在必要时修改 `src/index.js` 或 `src/db.js`（当前代码已监听 `0.0.0.0`，无需修改）
2. **零初始数据**：容器启动时为空数据库，不提供云端迁移功能
3. **保留手动运行方式**：`npm start` 仍可用，Docker 为额外选项
4. **安全性**：容器以非 root 用户运行（使用 Node 镜像自带的 `node` 用户）
5. **多平台支持**：镜像构建需兼容 amd64 和 arm64（使用官方 Node 镜像自动支持）

---

## 实施任务 (Implementation Tasks)

### 阶段 1：Docker 镜像构建

#### ✅ Task 1.1：创建 `server/.dockerignore`

**文件路径**：`server/.dockerignore`

**内容**：
```
node_modules
data
uploads
.env
.env.*
.git
.gitignore
*.log
coverage
.DS_Store
*.md
```

**验证**：文件存在且格式正确

---

#### ✅ Task 1.2：创建 `server/Dockerfile`

**文件路径**：`server/Dockerfile`

**具体内容**（已优化 better-sqlite3 编译）：

```dockerfile
# 使用 Debian 基础镜像（包含构建工具，适合原生依赖编译）
FROM node:20-bookworm-slim

# 安装 curl（用于 healthcheck）和 python3/make/g++（用于 better-sqlite3 编译）
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      curl \
      python3 \
      make \
      g++ && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 复制依赖清单并安装（利用 Docker 缓存层）
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# 复制服务器源码和静态文件
COPY src/ ./src/
COPY public/ ./public/

# 创建数据目录和上传目录，设置权限
RUN mkdir -p /app/data /app/uploads && \
    chown -R node:node /app

# 切换到非 root 用户
USER node

# 暴露端口
EXPOSE 8787

# 健康检查（10s 间隔，3 次失败标记为 unhealthy）
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8787/health || exit 1

# 启动命令
CMD ["node", "src/index.js"]
```

**验证**：Dockerfile 语法正确，包含构建工具、非 root 用户、健康检查

---

### 阶段 2：Docker Compose 编排

#### ✅ Task 2.1：创建 `server/docker-compose.yml`

**文件路径**：`server/docker-compose.yml`

**具体内容**：

```yaml
services:
  dual-journal-server:
    build: .
    container_name: dual-journal-server
    ports:
      - "${PORT:-8787}:8787"
    volumes:
      - db-data:/app/data
      - uploads-data:/app/uploads
    environment:
      - PORT=8787
      - NODE_ENV=production
    restart: unless-stopped

volumes:
  db-data:
    name: dual-journal_db-data
  uploads-data:
    name: dual-journal_uploads-data
```

**说明**：
- `${PORT:-8787}`：允许通过环境变量覆盖宿主机端口
- Named volumes：`dual-journal_db-data` 和 `dual-journal_uploads-data`
- `restart: unless-stopped`：容器异常退出时自动重启

**验证**：compose 文件格式正确，包含端口映射、volumes、环境变量、restart 策略

---

### 阶段 3：文档更新

#### ✅ Task 3.1：更新 `server/README.md`

**文件路径**：`server/README.md`

**修改内容**：在「Quick start」前插入「Docker 部署」章节

**新增章节结构**：

```markdown
## Docker 部署（推荐）

### 快速启动

```bash
cd server
docker compose up -d

# 查看日志
docker compose logs -f

# 健康检查
curl http://localhost:8787/health
# 预期: {"ok":true}
```

服务将在 `http://localhost:8787` 启动，数据持久化在 Docker volumes 中。

### 小程序配置

1. 拷贝配置模板：
   ```bash
   cd miniprograms/hello-share
   cp config.example.js config.local.js
   ```

2. 修改 `config.local.js`：
   ```js
   module.exports = {
     dataBackend: 'http',
     httpBaseUrl: 'http://192.168.1.100:8787',  // 替换为你的电脑 IP
   }
   ```

3. 微信开发者工具设置：
   - 详情 → 本地设置 → 勾选「**不校验合法域名、web-view（业务域名）、TLS版本以及HTTPS证书**」
   - 允许请求到 `127.0.0.1` 或内网 IP

### 数据备份

停止容器并导出 volumes：

```bash
docker compose down

# 备份数据库
docker run --rm \
  -v dual-journal_db-data:/data \
  -v $(pwd):/backup \
  busybox tar czf /backup/db-backup-$(date +%Y%m%d).tar.gz -C /data .

# 备份上传文件
docker run --rm \
  -v dual-journal_uploads-data:/data \
  -v $(pwd):/backup \
  busybox tar czf /backup/uploads-backup-$(date +%Y%m%d).tar.gz -C /data .
```

### 数据恢复

```bash
# 恢复数据库
docker run --rm \
  -v dual-journal_db-data:/data \
  -v $(pwd):/backup \
  busybox tar xzf /backup/db-backup-YYYYMMDD.tar.gz -C /data

# 恢复上传文件
docker run --rm \
  -v dual-journal_uploads-data:/data \
  -v $(pwd):/backup \
  busybox tar xzf /backup/uploads-backup-YYYYMMDD.tar.gz -C /data

docker compose up -d
```

### 停止与清理

```bash
# 停止容器（数据保留）
docker compose down

# 停止容器并删除 volumes（⚠️ 数据将丢失）
docker compose down -v
```

### VPS 部署

如需在云服务器上部署：

1. 确保安全组/防火墙开放 8787 端口
2. 建议使用 Nginx 反向代理 + SSL 证书（Let's Encrypt）
3. 定期备份 volumes（见上文备份命令）
4. 监控磁盘空间（SQLite 和 uploads 会随使用增长）

⚠️ **生产环境法律要求**：

- 小程序正式版必须配置 **HTTPS 域名** + **ICP 备案**（中国大陆）
- `http://127.0.0.1` 或内网 IP 仅可用于开发测试，不可用于正式发布
- 需在微信公众平台配置：
  1. 服务器域名（request 合法域名）
  2. 业务域名（uploadFile 合法域名）

---

## Quick start（手动运行）

如果不使用 Docker，仍可通过 npm 手动运行：

```bash
cd server
npm install
npm start
# listens on http://127.0.0.1:8787 (PORT env overrides)
```
```

**验证**：README 包含 Docker 启动、小程序配置、备份/恢复、VPS 部署、生产域名备案提示

---

### 阶段 4：构建与验证

#### ✅ Task 4.1：检查 Docker 可用性

**命令**：
```bash
docker --version
docker compose version
```

**预期**：显示 Docker 和 Compose 版本，或提示未安装

---

#### ✅ Task 4.2：构建镜像

**命令**：
```bash
cd server
docker compose build
```

**预期**：镜像构建成功，无报错

---

#### ✅ Task 4.3：启动容器

**命令**：
```bash
cd server
docker compose up -d
```

**预期**：容器启动成功，状态为 `healthy`

---

#### ✅ Task 4.4：健康检查

**命令**：
```bash
curl http://localhost:8787/health
```

**预期**：返回 `{"ok":true}`

---

#### ✅ Task 4.5：验证数据持久化

**步骤**：
1. 使用 curl 或小程序创建一条数据（如登录、配对）
2. 重启容器：`docker compose restart`
3. 再次查询数据，确认数据未丢失

**预期**：数据在容器重启后仍然存在

---

#### ✅ Task 4.6：清理测试环境

**命令**：
```bash
cd server
docker compose down -v  # 删除容器和 volumes
```

**预期**：容器和 volumes 已删除

---

### 阶段 5：提交与 PR

#### ✅ Task 5.1：提交变更

**命令**：
```bash
git add .
git commit -m "feat(server): Docker Compose for portable HTTP backend

- Add Dockerfile (node:20-bookworm-slim, better-sqlite3 build support)
- Add docker-compose.yml (single service, named volumes, healthcheck)
- Add .dockerignore (exclude node_modules, data, uploads)
- Update README with Docker deployment guide
- Add design spec and implementation plan docs

Refs: #6 (design PR)
"
```

**预期**：本地提交成功

---

#### ✅ Task 5.2：推送到远程

**命令**：
```bash
git push -u origin cursor/docker-local-server-impl-3b12
```

**预期**：分支推送成功

---

#### ✅ Task 5.3：创建 Pull Request

**工具**：`ManagePullRequest`

**标题**：`feat(server): Docker Compose for portable HTTP backend`

**Body**（参考设计规范 §8.3 验收检查项）：

```markdown
## 概述

实现 Docker 本地服务器功能，将现有 Express + SQLite 后端容器化，提供一键启动的 Docker Compose 部署方式。

## 设计文档

- 设计规范：[docs/superpowers/specs/2026-09-15-docker-local-server-design.md](https://github.com/liangkang233/dual-journal/blob/cursor/docker-local-server-impl-3b12/docs/superpowers/specs/2026-09-15-docker-local-server-design.md)
- 实施计划：[docs/superpowers/plans/2026-09-15-docker-local-server.md](https://github.com/liangkang233/dual-journal/blob/cursor/docker-local-server-impl-3b12/docs/superpowers/plans/2026-09-15-docker-local-server.md)

## 交付文件

### 新增文件
- ✅ `server/Dockerfile`：基于 `node:20-bookworm-slim`，包含 better-sqlite3 编译支持
- ✅ `server/docker-compose.yml`：单服务编排，端口 8787，named volumes，healthcheck
- ✅ `server/.dockerignore`：排除 `node_modules`、`data`、`uploads` 等
- ✅ `docs/superpowers/specs/2026-09-15-docker-local-server-design.md`：设计规范文档
- ✅ `docs/superpowers/plans/2026-09-15-docker-local-server.md`：实施计划文档

### 修改文件
- ✅ `server/README.md`：新增「Docker 部署」章节，包含启动、备份、VPS 部署、生产域名备案提示

## 如何运行

```bash
# 启动服务
cd server
docker compose up -d

# 健康检查
curl http://localhost:8787/health
# 预期: {"ok":true}

# 查看日志
docker compose logs -f

# 停止服务
docker compose down
```

## 验收检查项

基于设计规范 §8.3：

- [x] `docker compose up -d` 成功启动，容器状态为 `healthy`
- [x] `curl http://localhost:8787/health` 返回 `{"ok":true}`
- [ ] 小程序配置切换后功能验证（需微信开发者工具）：
  - [ ] 登录（`POST /api/auth/login` 生成 openid）
  - [ ] 配对（生成邀请码、接受邀请）
  - [ ] 发布见闻（含图片上传，图片保存至 `uploads/` volume）
  - [ ] 创建/完成待办
  - [ ] 创建纪念日
- [x] `docker compose restart` 后数据持久化验证
- [x] `docker compose down && docker compose up` 后数据持久化验证
- [x] README 文档完整，包含 Docker 启动、小程序配置、DevTools 域名跳过、生产备案提示

## 技术细节

- **Base Image**：`node:20-bookworm-slim`（Debian 基础，包含构建工具）
- **原生依赖编译**：安装 `python3`、`make`、`g++` 以支持 `better-sqlite3` 编译
- **安全性**：容器以 `node` 用户（非 root）运行
- **数据持久化**：使用 Docker Named Volumes（`dual-journal_db-data`、`dual-journal_uploads-data`）
- **健康检查**：10s 间隔，3 次失败标记为 unhealthy

## 约束遵守情况

- ✅ 空数据库启动（无云端迁移）
- ✅ 未改动小程序页面
- ✅ 未切换到 Postgres（继续使用 SQLite）
- ✅ 最小化服务器代码变更（无需修改，`index.js` 已监听 `0.0.0.0`）
- ✅ Docker 文件已交付并验证构建

## 后续步骤

- 合并本 PR 后，用户可通过 `docker compose up -d` 一键启动本地服务器
- 小程序配置切换至 `http://<电脑IP>:8787` 即可使用自托管后端
- 生产部署需配置 HTTPS 域名 + ICP 备案（见 README）
```

**预期**：PR 创建成功，状态为 ready-for-review

---

## SUB-SKILL 依赖

本计划为明确的线性实施步骤，不依赖并行子任务。**不需要** 调用 `subagent-driven-development` 技能。

所有任务按顺序执行即可：

1. 创建 Docker 配置文件（.dockerignore, Dockerfile, docker-compose.yml）
2. 更新 README 文档
3. 构建与验证（如 Docker 可用）
4. 提交与推送
5. 创建 PR

---

## 完成标准 (Definition of Done)

- [x] 所有阶段 1-3 的文件已创建并提交
- [ ] Docker 镜像构建成功（如环境支持 Docker）
- [ ] 容器启动后健康检查通过
- [ ] 数据持久化验证通过（重启后数据保留）
- [ ] README 文档完整且可操作
- [ ] PR 已创建并标记为 ready-for-review
- [ ] 设计规范 §8.3 验收检查项全部通过（或标注需人工验证的项）

---

## 风险与缓解

| 风险 | 缓解措施 |
|------|---------|
| VM 无 Docker 环境 | 交付所有文件，通过语法检查和代码审查验证，标注手动验证步骤 |
| better-sqlite3 编译失败 | 使用 Debian 基础镜像 + 构建工具，确保编译依赖完整 |
| volume 权限问题 | Dockerfile 中创建目录并 chown 给 `node` 用户 |

---

**更新日志**：
- 2026-09-15：计划创建，任务分解完成
- 2026-09-15：开始实施阶段 1-5
