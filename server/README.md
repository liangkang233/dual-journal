# Self-hosted API (Express + SQLite)

Local backend for the hello-share miniprogram when `config.dataBackend === 'http'`.

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
