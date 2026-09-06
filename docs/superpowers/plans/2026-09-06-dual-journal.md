# 「双人见闻」Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有 `hello-share` 上实现双人云同步见闻本：邀请配对、图文见闻、带优先级待办、纪念日（应用内+订阅消息）、可换背景。

**Architecture:** 微信原生小程序 + 微信云开发。客户端按 `pairId` 读写云数据库/云存储；配对与订阅消息定时推送走云函数。纯逻辑（邀请码、优先级排序、纪念日命中）放在 `utils/` 便于 Node 单测。

**Tech Stack:** 微信原生（WXML/WXSS/JS）、云开发（DB/Storage/Functions）、本地 Node assert 测 utils。

## Global Constraints

- AppID：`wxe973b8825d2d5991`；工程根：`/workspace/miniprograms/hello-share`
- 一对最多 2 人；邀请码过期 48 小时
- 见闻：标题+正文+最多 9 张图；定位/心情 v1 不做
- 待办：priority `high|medium|low`，status `open|done`，双方可 CRUD
- 订阅消息失败静默降级为应用内提醒
- UI 中文；底部 Tab：见闻 | 待办 | 纪念 | 我们
- Spec：`docs/superpowers/specs/2026-09-06-dual-journal-design.md`

## File map

| Path | Responsibility |
|------|----------------|
| `app.js` / `app.json` / `app.wxss` | 云初始化、全局 pair 状态、TabBar |
| `utils/invite.js` | 生成/校验邀请码格式 |
| `utils/todoSort.js` | 待办排序 |
| `utils/anniversary.js` | 今日是否命中纪念日 |
| `services/auth.js` | openid / 当前用户 |
| `services/pair.js` | 配对读写封装 |
| `services/entries.js` | 见闻 CRUD + 上传图 |
| `services/todos.js` | 待办 CRUD |
| `services/anniversaries.js` | 纪念日 CRUD |
| `pages/feed/*` | 时间线、编辑、详情 |
| `pages/todos/*` | 待办列表与编辑 |
| `pages/anniversaries/*` | 纪念日 |
| `pages/pair/*` | 邀请、背景、订阅授权 |
| `cloudfunctions/login/` | 返回 openid |
| `cloudfunctions/createInvite/` | 建 pair 或刷新邀请 |
| `cloudfunctions/acceptInvite/` | 加入 pair |
| `cloudfunctions/onAnniversaryTick/` | 定时订阅消息 |
| `tests/*.test.js` | utils 单测 |

---

### Task 1: Utils + 单测骨架

**Files:**
- Create: `utils/invite.js`, `utils/todoSort.js`, `utils/anniversary.js`
- Create: `tests/invite.test.js`, `tests/todoSort.test.js`, `tests/anniversary.test.js`
- Create: `package.json`（仅 test 脚本，无小程序运行时依赖）

**Interfaces:**
- Produces: `generateInviteCode(): string`（6 位大写字母数字）；`isInviteCodeFormat(code: string): boolean`
- Produces: `sortTodos(todos: Array): Array`（open 优先，再 high>medium>low，再 dueAt 升序）
- Produces: `isAnniversaryToday(ann, nowDate=new Date()): boolean`（支持 `repeatYearly`）

- [ ] **Step 1: Write failing tests**

```js
// tests/todoSort.test.js
const assert = require('assert')
const { sortTodos } = require('../utils/todoSort')
const sorted = sortTodos([
  { title: 'a', priority: 'low', status: 'open' },
  { title: 'b', priority: 'high', status: 'done' },
  { title: 'c', priority: 'high', status: 'open' },
])
assert.strictEqual(sorted[0].title, 'c')
assert.strictEqual(sorted[1].title, 'a')
assert.strictEqual(sorted[2].title, 'b')
console.log('todoSort ok')
```

同理覆盖 invite 格式与 anniversary 每年重复。

- [ ] **Step 2: Run tests — expect FAIL (module missing)**

Run: `node tests/todoSort.test.js`

- [ ] **Step 3: Implement utils**

```js
// utils/todoSort.js
const RANK = { high: 0, medium: 1, low: 2 }
function sortTodos(todos) {
  return [...todos].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'open' ? -1 : 1
    if (RANK[a.priority] !== RANK[b.priority]) return RANK[a.priority] - RANK[b.priority]
    const da = a.dueAt || Number.MAX_SAFE_INTEGER
    const db = b.dueAt || Number.MAX_SAFE_INTEGER
    return da - db
  })
}
module.exports = { sortTodos }
```

invite：`Math.random` 生成 6 位 `[A-Z0-9]`；anniversary：比较月日（`repeatYearly`）或完整年月日。

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit** `feat: add invite/todo/anniversary utils and tests`

---

### Task 2: App 壳 + TabBar + 云初始化

**Files:**
- Modify: `app.js`, `app.json`, `app.wxss`
- Create: `pages/feed/index.*`, `pages/todos/index.*`, `pages/anniversaries/index.*`, `pages/pair/index.*`（占位 UI）
- Remove or stop using `pages/index/*` as tab（可删或留作跳转）

**Interfaces:**
- Produces: `App.globalData = { openid: '', pairId: '', pair: null }`
- Produces: `app.json` tabBar 四项中文

- [ ] **Step 1: 写 app.json pages + tabBar**（见闻/待办/纪念/我们）
- [ ] **Step 2: app.js 中 `wx.cloud.init({ env: '请替换为云环境ID', traceUser: true })`，并 `onLaunch` 调 login 占位**
- [ ] **Step 3: 四页占位「未配对」空态文案**
- [ ] **Step 4: 开发者工具编译无报错（人工/截图）**
- [ ] **Step 5: Commit** `feat: scaffold tab bar and cloud init`

注：云环境 ID 用占位符 `CLOUD_ENV_ID`，在 `app.js` 顶部常量，开通云开发后替换。

---

### Task 3: 登录云函数 + 配对云函数

**Files:**
- Create: `cloudfunctions/login/index.js`, `package.json`
- Create: `cloudfunctions/createInvite/index.js`, `package.json`
- Create: `cloudfunctions/acceptInvite/index.js`, `package.json`
- Create: `services/auth.js`, `services/pair.js`
- Modify: `pages/pair/index.js|wxml|wxss`

**Interfaces:**
- Produces cloud: `login` → `{ openid }`
- Produces cloud: `createInvite` → `{ pairId, inviteCode, inviteExpireAt }`（已有 pair 则刷新码；已满 2 人则错误）
- Produces cloud: `acceptInvite({ inviteCode })` → `{ pairId }`（校验格式、过期、人数）
- Produces: `services/pair.getMyPair()`, `createInvite()`, `acceptInvite(code)`

- [ ] **Step 1: 实现 login 云函数**（`cloud.getWXContext().OPENID`）
- [ ] **Step 2: createInvite / acceptInvite 读写 `pairs` 集合**
- [ ] **Step 3: pair 页：显示「生成邀请码」「输入邀请码加入」、分享 `path` 带 query**
- [ ] **Step 4: 真机/模拟器两人逻辑用两个测试号或清存储模拟（文档化步骤）**
- [ ] **Step 5: Commit** `feat: cloud login and invite pairing`

**pairs 字段：** 与 spec 5.1 一致。

---

### Task 4: 见闻时间线 + 写图文 + 详情

**Files:**
- Create: `pages/feed/edit.*`, `pages/feed/detail.*`
- Modify: `pages/feed/index.*`
- Create: `services/entries.js`

**Interfaces:**
- Produces: `listEntries(pairId)`, `createEntry({ title, content, tempFilePaths })`, `getEntry(id)`
- 上传：`wx.cloud.uploadFile` → `imageFileIds[]`，路径 `pairs/{pairId}/entries/{id}/{n}.jpg`

- [ ] **Step 1: entries service + 安全：无 pairId 拒绝**
- [ ] **Step 2: feed 列表倒序；点击进详情**
- [ ] **Step 3: edit 页表单，最多 9 图，提交写库**
- [ ] **Step 4: 未配对拦截并跳转「我们」**
- [ ] **Step 5: Commit** `feat: entries feed create and detail`

---

### Task 5: 双人待办 + 优先级

**Files:**
- Modify: `pages/todos/index.*`
- Create: `pages/todos/edit.*`（或用页面内弹层）
- Create: `services/todos.js`

**Interfaces:**
- Produces: `listTodos`, `upsertTodo`, `setTodoStatus`, `removeTodo`
- 列表渲染前调用 `sortTodos`

- [ ] **Step 1: todos service**
- [ ] **Step 2: 列表 UI：优先级色点、勾选完成、删除**
- [ ] **Step 3: 新建/编辑：标题、优先级、可选截止日期**
- [ ] **Step 4: 用 utils 单测保证排序；页面手测完成态沉底**
- [ ] **Step 5: Commit** `feat: pair todos with priority`

---

### Task 6: 纪念日 + 应用内今日提示 + 订阅消息骨架

**Files:**
- Modify: `pages/anniversaries/index.*`, `pages/feed/index.*`（今日横幅）
- Create: `services/anniversaries.js`
- Create: `cloudfunctions/onAnniversaryTick/index.js`
- Modify: `pages/pair/index.*`（`wx.requestSubscribeMessage`）

**Interfaces:**
- Produces: CRUD anniversaries；`getTodaysAnniversaries(list, now)`
- Tick：查当日纪念 → 查 `subscriptions` → `cloud.openapi.subscribeMessage.send`（模板 ID 常量 `SUBSCRIBE_TMPL_ID`）

- [ ] **Step 1: anniversaries 页面 CRUD**
- [ ] **Step 2: feed 顶横幅用 `isAnniversaryToday`**
- [ ] **Step 3: pair 页请求订阅；写入 `subscriptions`**
- [ ] **Step 4: onAnniversaryTick 云函数 + 说明需在云开发配置定时触发器**
- [ ] **Step 5: Commit** `feat: anniversaries and subscribe message hook`

---

### Task 7: 背景主题 + 收尾

**Files:**
- Modify: `pages/pair/index.*`, `app.wxss` / 各页容器 class
- Modify: `services/pair.js`（`updateBackground`）

**Interfaces:**
- Produces: 预设 id 列表 `warm|mint|night|plain`；自定义图上传 `pairs/{pairId}/background.jpg`

- [ ] **Step 1: 预设切换写回 pair**
- [ ] **Step 2: 自定义上传**
- [ ] **Step 3: feed/todos 等页读取 `pair.background` 应用**
- [ ] **Step 4: README 简短：开通云环境、部署云函数、替换 env/模板 ID、体验版步骤**
- [ ] **Step 5: Commit** `feat: pair backgrounds and setup readme`

---

## Spec coverage checklist

| Spec 项 | Task |
|---------|------|
| 云同步 / pairId | 3–7 |
| 邀请码/链接、2 人、48h | 3 |
| 图文见闻、历史翻阅 | 4 |
| 待办优先级 | 5 |
| 纪念日 + 订阅降级 | 6 |
| 换背景 | 7 |
| 权限未配对不可写 | 3–5 |
| 定位心情不做 | —（刻意省略）|

## Execution notes

- 云开发控制台操作（建环境、上传云函数、安全规则、定时触发器）需在开发者工具内由用户/协助完成；代码侧用占位常量。
- 优先 subagent-driven：每完成一 Task 再开下一 Task。
