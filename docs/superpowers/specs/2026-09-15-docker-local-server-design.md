# Docker 本地服务器设计（空库启动，不含云端迁移）

- 日期：2026-09-15
- 状态：用户已确认，待后续实现 PR
- 目标：将现有 Express + SQLite 后端容器化，作为微信云开发的便携自托管备选方案

## 1. 背景与动机

「双人见闻」小程序当前使用微信云开发（云数据库 + 云存储）作为主数据源。为满足以下场景需求，需要提供本地 HTTP 服务器选项：

1. **便携性**：开发者和高级用户可在笔记本或任意 VPS 上一键启动服务端，脱离云开发依赖
2. **成本控制**：自托管减少云服务计费，适合小流量个人部署
3. **数据主权**：用户完全掌控数据库文件与上传文件，方便备份与迁移
4. **故障切换**：微信云开发服务异常时，可快速切换至本地或 VPS 实例

现有 `server/` 目录已包含完整的 Express + SQLite 实现（见 `server/README.md`），支持 pairs、entries、todos、anniversaries 等全部业务实体的 CRUD 操作。本设计目标是**将此服务容器化**，提供即开即用的 Docker 部署方式。

## 2. 目标（Goals）

本期设计与实现聚焦以下目标：

1. **单容器 Docker Compose 部署**：通过 `docker compose up -d` 启动完整服务
2. **数据持久化**：SQLite 数据库文件与上传文件通过 Docker volumes 持久化，容器重启数据不丢失
3. **零初始数据**：容器启动时初始化为空数据库，用户从头开始配对与记录
4. **保留手动运行选项**：现有 `npm install && npm start` 方式仍然支持，Docker 为额外选项而非替代
5. **文档完善**：README 明确说明 Docker 启动方式、小程序配置指向、DevTools 域名跳过、生产环境法律要求（域名备案提示）

### 成功标准

- 用户执行 `docker compose up -d` 后，服务在 `http://localhost:8787` 可访问
- 小程序通过 `config.local.js` 切换 `dataBackend: 'http'` + `httpBaseUrl` 后，可正常完成配对、发见闻、建待办等操作
- SQLite 文件与 uploads 目录内容在容器重启后保留
- 可选：提供简单备份说明（复制 volume 数据或导出 tar）

## 3. 非目标（Non-goals）

本期**不做**以下内容：

1. **云端→本地数据迁移工具**：不提供从微信云数据库批量导入数据到 SQLite 的脚本或界面
2. **Postgres 支持**：继续使用 SQLite，不引入其他数据库引擎
3. **小程序页面重写**：不改动 `miniprograms/hello-share` 的任何业务逻辑或 UI
4. **多容器架构**：不拆分为 Nginx + Node + DB 等多服务，保持单容器简洁部署
5. **Kubernetes / Helm Chart**：不提供 K8s 编排配置，仅 Docker Compose

## 4. 整体架构

```
┌────────────────────────────────────────────────────────┐
│  用户设备（微信开发者工具 / 真机）                    │
│  ┌──────────────────────────────────────────┐          │
│  │  hello-share 小程序                      │          │
│  │  config.local.js:                        │          │
│  │    dataBackend: 'http'                   │          │
│  │    httpBaseUrl: 'http://192.168.x.x:8787'│          │
│  └──────────────────────────────────────────┘          │
└─────────────────────┬──────────────────────────────────┘
                      │ HTTP API
                      ▼
┌────────────────────────────────────────────────────────┐
│  Docker 容器 (dual-journal-server)                     │
│  ┌──────────────────────────────────────────┐          │
│  │  Node.js >=18 + Express                  │          │
│  │  ├─ src/index.js  (启动服务)            │          │
│  │  ├─ src/db.js     (SQLite 操作)         │          │
│  │  └─ routes + middleware                  │          │
│  └──────────────────────────────────────────┘          │
│  ┌──────────────────────────────────────────┐          │
│  │  Named Volume: db-data                   │          │
│  │  → /app/data/dual-journal.sqlite         │          │
│  └──────────────────────────────────────────┘          │
│  ┌──────────────────────────────────────────┐          │
│  │  Named Volume: uploads-data              │          │
│  │  → /app/uploads/                         │          │
│  └──────────────────────────────────────────┘          │
│                                                         │
│  暴露端口: 8787 (可通过 PORT 环境变量覆盖)             │
└────────────────────────────────────────────────────────┘
```

### 关键组件

| 组件                | 职责                                                                 |
|---------------------|----------------------------------------------------------------------|
| **Dockerfile**      | 基于 Node >=18 镜像，`npm ci` 安装依赖（含 better-sqlite3 原生编译），COPY 源码，CMD 启动 |
| **docker-compose.yml** | 定义服务 `dual-journal-server`，映射端口 8787、挂载 volumes、设置环境变量、配置 healthcheck |
| **.dockerignore**   | 排除 node_modules、data/、uploads/、.env、.git 等不应进入镜像的文件  |
| **Named Volumes**   | `db-data` 存放 SQLite 文件，`uploads-data` 存放图片等上传内容        |
| **Healthcheck**     | `GET /health` 返回 200 + `{ "ok": true }` 时视为健康                  |

## 5. 数据持久化与可移植性

### 5.1 持久化方案

采用 **Docker Named Volumes**（也可在 compose 中切换为 bind mount）：

- **db-data volume → `/app/data/`**：存放 `dual-journal.sqlite` 及可能的 WAL / SHM 文件
- **uploads-data volume → `/app/uploads/`**：存放用户上传的图片（UUID 文件名，如 `abc-123.jpg`）

容器删除后，volume 默认保留；重新 `docker compose up` 会重用已有数据。

### 5.2 备份与迁移

**备份步骤（示例）**：

```bash
# 停止容器
docker compose down

# 导出 volumes 为 tar
docker run --rm \
  -v dual-journal_db-data:/data \
  -v $(pwd):/backup \
  busybox tar czf /backup/db-backup-$(date +%Y%m%d).tar.gz -C /data .

docker run --rm \
  -v dual-journal_uploads-data:/data \
  -v $(pwd):/backup \
  busybox tar czf /backup/uploads-backup-$(date +%Y%m%d).tar.gz -C /data .

# 重新启动容器
docker compose up -d
```

**恢复步骤（示例）**：

1. 创建新 volume 或清空现有 volume
2. 使用 `docker run --rm -v ... busybox tar xzf ...` 解压备份
3. 启动容器

### 5.3 数据初始化

- 容器首次启动时，`src/db.js` 检测 `data/dual-journal.sqlite` 不存在，自动执行 `CREATE TABLE` 建表语句
- **无预置数据**，无云端导入逻辑；用户从空库开始使用

## 6. 小程序配置切换

小程序已通过 `config/index.js` 支持后端切换（参考现有 `adapters/cloud.js` 与 `adapters/http.js`）。

### 切换步骤

1. **拷贝配置模板**：`cp config.example.js config.local.js`（config.local.js 已被 .gitignore）
2. **修改配置**：

   ```js
   // config.local.js
   module.exports = {
     dataBackend: 'http',           // 从 'cloud' 改为 'http'
     httpBaseUrl: 'http://192.168.1.100:8787',  // Docker 宿主机 IP + 端口
   }
   ```

3. **DevTools 设置**：
   - 打开微信开发者工具
   - 详情 → 本地设置 → **不校验合法域名、web-view（业务域名）、TLS版本以及HTTPS证书**（勾选）
   - 允许请求到 `127.0.0.1` 或内网 IP

4. **真机测试**：
   - 需要手机与运行 Docker 的电脑在同一局域网
   - `httpBaseUrl` 填写电脑内网 IP（如 `http://192.168.1.100:8787`）
   - 小程序代码片段或体验版需在微信公众平台配置合法域名（生产环境需备案域名）

### 生产环境法律合规

⚠️ **重要提示**：

- 小程序正式版上架必须配置**合法的 HTTPS 域名**，且域名需完成 **ICP 备案**（中国大陆）
- 本地 `http://127.0.0.1` 或内网 IP 仅可用于开发/体验版测试，不可用于正式发布
- 生产部署需：
  1. 购买域名并完成备案
  2. 部署 SSL 证书（Let's Encrypt 或商业证书）
  3. 在微信公众平台「开发 → 开发管理 → 服务器域名」中配置 request 合法域名
  4. 在微信公众平台「开发 → 开发管理 → 业务域名」中配置 uploadFile 合法域名（如需）

## 7. 运维操作手册（概要）

本节为后续 README 章节提供纲要，实现时扩展为可操作步骤。

### 7.1 启动服务

```bash
# 克隆项目后
cd dual-journal/server

# 一键启动（拉取镜像、构建、启动容器）
docker compose up -d

# 查看日志
docker compose logs -f

# 健康检查
curl http://localhost:8787/health
# 预期: {"ok":true}
```

### 7.2 停止与重启

```bash
# 停止容器（数据保留）
docker compose down

# 重启
docker compose restart
```

### 7.3 数据清理与重置

```bash
# 停止并删除容器 + volumes（⚠️ 数据将丢失）
docker compose down -v

# 仅删除容器，保留 volumes
docker compose down
docker volume rm dual-journal_db-data dual-journal_uploads-data
```

### 7.4 升级镜像

```bash
# 拉取最新代码
git pull origin master

# 重新构建镜像
docker compose build

# 重启服务
docker compose up -d
```

### 7.5 环境变量调优

可在 `docker-compose.yml` 或 `.env` 文件中覆盖：

- `PORT`：服务监听端口（默认 8787）
- `NODE_ENV`：`production` 或 `development`
- `LOG_LEVEL`：日志级别（如需）

### 7.6 VPS 部署注意事项

- 确保安全组/防火墙开放目标端口（如 8787）
- 生产环境建议前置 Nginx 反向代理 + SSL 证书
- 定期备份 volumes（见 5.2 节）
- 监控磁盘空间（SQLite + uploads 会增长）

## 8. 实现计划（Deliverables）

以下为后续实现 PR 应交付的文件与变更（**本设计文档 PR 不包含这些文件**）：

### 8.1 新增文件

| 文件路径                       | 内容要点                                                                 |
|--------------------------------|--------------------------------------------------------------------------|
| `server/Dockerfile`            | 基于 `node:18-alpine` 或 `node:20-alpine`；`WORKDIR /app`；`RUN npm ci`（包含 better-sqlite3 原生编译）；`EXPOSE 8787`；`CMD ["node", "src/index.js"]` |
| `server/docker-compose.yml`    | 定义 service `dual-journal-server`，image build context，ports `8787:8787`，volumes `db-data:/app/data` & `uploads-data:/app/uploads`，healthcheck `curl -f http://localhost:8787/health` |
| `server/.dockerignore`         | 排除 `node_modules/`、`data/`、`uploads/`、`.env`、`.git/`、`*.log`、`README.md`（可选）等 |

### 8.2 修改文件

| 文件路径                       | 变更内容                                                                 |
|--------------------------------|--------------------------------------------------------------------------|
| `server/README.md`             | 新增「**Docker 部署**」章节（置于「Quick start」之前或平行）；包含一键启动命令、volume 说明、备份示例、VPS 部署提示、生产域名/备案法律提示；保留原有 `npm start` 说明 |

### 8.3 验收检查项

- [ ] `docker compose up -d` 成功启动，容器健康
- [ ] `curl http://localhost:8787/health` 返回 `{"ok":true}`
- [ ] 小程序配置切换至 `http://localhost:8787` 后，可完成：
  - [ ] 登录（`POST /api/auth/login` 生成 openid）
  - [ ] 配对（生成邀请码、接受邀请）
  - [ ] 发布见闻（含图片上传，图片保存至 `uploads/` volume）
  - [ ] 创建/完成待办
  - [ ] 创建纪念日
- [ ] `docker compose restart` 后数据未丢失（pair、entries 等仍存在）
- [ ] `docker compose down && docker compose up` 后数据未丢失
- [ ] README 文档清晰，包含 Docker 启动、小程序配置、DevTools 域名跳过、生产备案提示等章节

## 9. 风险与缓解

| 风险                                   | 影响                                       | 缓解措施                                                                 |
|----------------------------------------|--------------------------------------------|-----------------------------------------------------------------|
| **better-sqlite3 原生依赖编译失败**    | Docker 镜像构建失败，容器无法启动          | Dockerfile 使用官方 Node 镜像（含 build-essential 或 alpine 补充 python3/make/g++）；测试 Alpine/Debian 两种 base image |
| **Volume 权限问题**                    | 容器无写权限，数据库初始化失败             | Dockerfile `RUN mkdir -p /app/data /app/uploads && chown node:node ...`；或在 compose 中指定 user |
| **端口冲突**                           | 宿主机 8787 已被占用，启动失败             | docker-compose.yml 支持 `PORT` 环境变量；README 说明如何修改端口映射 |
| **SQLite 并发写入限制**                | 多用户同时写入时可能锁超时                 | 当前单用户/双人场景并发低，风险可控；后续可考虑 WAL 模式或迁移 Postgres |
| **小程序正式版域名校验**               | 用户误用 `http://127.0.0.1` 提审被拒       | README 显著标注生产需 HTTPS + 备案域名；考虑在登录接口返回警告（可选） |
| **Docker 宿主机磁盘满**                | SQLite 与 uploads 持续增长导致空间不足     | README 提供 volume 清理与备份指引；建议监控磁盘（可选：日志轮转） |

## 10. 后续扩展可能性（Out of current scope）

本设计为 MVP，以下为后续可能迭代方向（不纳入本期实现）：

1. **云端→本地数据迁移脚本**：读取微信云数据库导出 JSON，批量插入 SQLite
2. **Postgres 支持**：提供 `DB_TYPE` 环境变量切换数据库引擎
3. **多容器编排**：Nginx + Node + Postgres 分离，提供 `docker-compose.prod.yml`
4. **自动 HTTPS（Let's Encrypt）**：集成 Caddy 或 Traefik 自动申请证书
5. **管理后台**：Web UI 查看 pairs/entries/todos，用户管理，数据备份/恢复
6. **监控与告警**：集成 Prometheus + Grafana，监控容器健康、磁盘、请求 QPS
7. **Kubernetes Helm Chart**：支持 K8s 集群部署与自动扩缩容

## 11. 参考资料

- [Docker Compose 官方文档](https://docs.docker.com/compose/)
- [better-sqlite3 文档](https://github.com/WiseLibs/better-sqlite3/wiki)
- [微信小程序服务器域名配置](https://developers.weixin.qq.com/miniprogram/dev/framework/ability/network.html)
- 项目现有文档：`server/README.md`、`config.example.js`、`docs/superpowers/specs/2026-09-06-dual-journal-design.md`

## 12. 确认与批准

- [x] 用户已确认本设计范围：**容器化现有服务 + 空库启动，不含云迁移**
- [x] 已明确实现 PR 交付物：Dockerfile、docker-compose.yml、.dockerignore、README 更新
- [x] 已明确非目标：云迁移、Postgres、小程序改动、多容器拆分、K8s
- [ ] 实现 PR 完成后标记本行

---

**下一步**：基于本设计文档创建实现 PR，包含上述 8.1、8.2 节所列文件，并通过 8.3 验收检查。
