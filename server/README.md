# Self-hosted API (Express + SQLite)

Local backend for the hello-share miniprogram when `config.dataBackend === 'http'`.

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

## Quick start

```bash
cd server
npm install
npm start
# listens on http://127.0.0.1:8787 (PORE env overrides)
```

Health check: `GET /health` -> `{ "ok": true }`.

Client setup:

1. Copy `../config.example.js` -> `../config.local.js` (gitignored).
2. Set `dataBackend: 'http'`, `httpBaseUrl: 'http://127.0.0.1:8787'`.
3. In WeChat DevTools: **Details -> Local settings -> do not verify valid domain names** so requests to `127.0.0.1` work.

## Auth

- `POST /api/auth/login` -- returns `{ openid }`.
  - If `x-openid` header or body `{ openid }` / `{ debugOpenid }` is present, that value is echoed.
  - Otherwise a `local_<uuid>` is generated.
- Authenticated routes require header `x-openid`.

## Endpoints (mirrors adapters/http/*)

- GET /api/pairs/me
- POST /api/pairs/invite (6-char code, 48h expiry, max 2 members)
- POST /api/pairs/accept { inviteCode }
- PUT/POST /api/pairs/:id/background (JSON or multipart file)
- GET/POST /api/entries, GET/PATCH /api/entries/:id, POST /api/entries/:id/images
- todos CRUD: GET/POST /api/todos, GET/PUT/DELETE /api/todos/:id, PATCH /api/todos/:id/status
- anniversaries CRUD: GET/POST /api/anniversaries, GET/PUT/DELETE /api/anniversaries/:id

Uploads under server/uploads/, served at /uploads/... fileId like /uploads/<uuid>.jpg.

## SQLite schema

DB file: `server/data/dual-journal.sqlite` (gitignored).

- *pairs* -- `_id`, `member_openids` (JSON) , `invite_code`, `invite_expire_at`, `invite_active`, `background` (JSON), `created_at`, `updated_at`
- *entries* -- `_id`, `pair_id`, `author_openid`, title, content, `image_file_ids` (JSON) , created_at, updated_at
- *todos* -- _id, pair_id, title, priority, status, due_at, creator_openid, updated_by_openid, created_at, updated_at
- *anniversaries* -- _id, pair_id, title, date, repeat_yearly, created_at, updated_at
- *subscriptions* -- stub

API JSON uses camelCase (memberOpenids, imageFileIds, etc.).

## Maintain

- Restart: stop Node, then npm start.
- Reset data: delete data/dual-journal.sqlite and optionally uploads/, restart.
- Do not commit config.local.js, server/data/, server/uploads/, or .env.

### Background

```bash
cd server
nohup node src/index.js >> /tmp/dual-journal-server.log 2>&1 &
echo $! > /tmp/dual-journal-server.pid
```
