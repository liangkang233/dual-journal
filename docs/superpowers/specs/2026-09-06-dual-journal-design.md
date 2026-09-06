# 「双人见闻」小程序设计说明

- 日期：2026-09-06
- 状态：待用户确认后进入实现计划
- 技术选型：微信原生小程序 + 微信云开发（云数据库 / 云存储 / 云函数）
- 工程路径：`/workspace/miniprograms/hello-share`（AppID：`wxe973b8825d2d5991`）

## 1. 目标

为两个人提供一份云端同步的共同空间，支持：

1. 记录所见所闻（图文）
2. 翻阅历史提交
3. 更换空间背景
4. 纪念日提醒（应用内 + 尽量订阅消息推送）
5. 双人待办（含优先级）

成功标准（v1）：两人用各自手机，经邀请码/链接结成一对后，能互相看到同一份见闻、待办与纪念日；未授权推送时仍能在打开小程序时看到「今日纪念」。

## 2. 非目标（v1 不做）

- 定位、心情标签（明确留到后续）
- 支付、商城、陌生人社交
- 自建服务器 / 独立域名备案
- 强制解绑流程的完整产品化（可仅预留退出接口，复杂双方确认放后续）
- uni-app / Taro 跨端

## 3. 信息架构与页面

底部 Tab：**见闻** | **待办** | **纪念** | **我们**

| 页面 | 路径（拟定） | 职责 |
|------|----------------|------|
| 见闻时间线 | `pages/feed/index` | 按时间倒序展示 pair 内见闻；右下角进入「写一条」；应用背景 |
| 写见闻 | `pages/feed/edit` | 标题、正文、多图选择与上传、提交 |
| 见闻详情 | `pages/feed/detail` | 单条详情、图片预览 |
| 待办 | `pages/todos/index` | 列表、勾选完成、按优先级与未完成优先排序；新建/编辑 |
| 纪念 | `pages/anniversaries/index` | 纪念日列表与新建/编辑 |
| 我们 | `pages/pair/index` | 登录态、邀请码生成与接受、背景更换、订阅消息授权入口 |

未配对：Tab 可进入，但见闻/待办/纪念引导去「我们」完成配对；或「我们」以外只读空态 + CTA。

## 4. 配对与身份

1. `wx.cloud.callFunction`（或云开发登录）获取用户 `openid`
2. 一方在「我们」生成邀请码（短码）或小程序分享路径（带 `inviteCode`）
3. 另一方输入码或打开分享链接，云函数校验后写入同一 `pair`
4. 规则：一对最多 2 人；满员后邀请失效；邀请码过期时间固定为 48 小时（实现时可改为配置项）

## 5. 数据模型（云数据库）

所有业务文档带 `pairId`。安全规则：仅 pair 成员可读写本 pair 数据。

### 5.1 `pairs`

- `_id` / `pairId`
- `memberOpenids`: string[2]
- `inviteCode`, `inviteExpireAt`, `inviteActive`
- `background`: `{ type: 'preset' \| 'custom', presetId?: string, fileId?: string }`
- `createdAt`, `updatedAt`

### 5.2 `entries`（见闻）

- `pairId`
- `authorOpenid`
- `title`, `content`
- `imageFileIds`: string[]（云存储 fileID）
- `createdAt`, `updatedAt`
- 预留（v1 不写）：`location`, `mood`

### 5.3 `todos`

- `pairId`
- `title`
- `priority`: `high` \| `medium` \| `low`（展示：高 / 中 / 低）
- `status`: `open` \| `done`
- `dueAt`?: number（可选）
- `creatorOpenid`, `updatedByOpenid`
- `createdAt`, `updatedAt`

排序：未完成优先，再按 priority（高→低），再按 `dueAt` / `updatedAt`。

双方均可对本 pair 待办做增删改（含完成状态）。

### 5.4 `anniversaries`

- `pairId`
- `title`
- `date`（月日或完整日期；`repeatYearly`: boolean）
- `createdAt`, `updatedAt`

### 5.5 `subscriptions`

- `openid`, `pairId`
- `templateId`
- `authorizedAt`, `lastSentAt`
- 用于定时任务判断是否可发订阅消息

## 6. 云存储与云函数

**存储路径约定（示例）：** `pairs/{pairId}/entries/{entryId}/{n}.jpg`、`pairs/{pairId}/background.jpg`

**云函数（拟定）：**

- `login` / 获取 openid（若需）
- `createInvite` / `acceptInvite`
- `onAnniversaryTick`（定时触发）：扫描当日纪念日，向已授权成员发送订阅消息；失败不抛到客户端
- 可选：`createEntry` 若需服务端校验图片数量

**图片限制（v1）：** 单条见闻最多 9 张、单张大小按微信选择器与云存储惯例限制；失败可重试。

## 7. 纪念日提醒策略

1. **应用内**：打开「见闻」或「纪念」时，查询今日是否命中纪念日，展示横幅/角标
2. **订阅消息**：在「我们」引导用户授权；定时云函数尽量推送
3. 授权失败、额度用尽或发送失败 → **静默降级**为仅应用内提醒，不阻断其他功能

## 8. 背景

- 若干预设主题（色/图）
- 可上传一张自定义图，写入 `pairs.background`
- 见闻时间线与主要页面读取 pair 背景渲染

## 9. 权限与异常

- 数据库：按 `openid ∈ memberOpenids` 限制
- 未配对禁止写入 `entries` / `todos` / `anniversaries`
- 邀请满员或过期返回明确错误文案
- 网络/上传失败：Toast + 保留本地表单草稿（可用 `wx.setStorage` 短草稿）

## 10. 扩展性

- 新实体一律挂 `pairId`（已用于见闻/待办/纪念）
- 后续可加：心情、定位、待办指派给人、解绑双方确认、更多提醒模板
- UI 层 Tab 可增页，不强制改已有集合字段语义

## 11. 实现分期（文档级，非详细排期）

1. 开通云开发环境、初始化集合与安全规则
2. 配对（邀请码 + 分享）
3. 见闻 CRUD + 图片 + 时间线/详情 + 背景
4. 待办 CRUD + 优先级排序
5. 纪念日 + 应用内今日提示 + 订阅消息与定时函数
6. 体验版上传与双人真机验证

## 12. 测试要点

- 两人两设备：邀请成功后数据一致
- 第三人无法加入已满 pair
- 仅一人时写见闻/待办的权限表现符合产品设定（建议：配对前不可写）
- 待办优先级排序与完成态
- 无订阅授权时纪念日仍可见
- 背景预设与自定义切换

## 13. 已确认决策摘要

| 项 | 决策 |
|----|------|
| 同步 | 微信云开发，双端可见 |
| 绑定 | 邀请码 / 邀请链接，最多 2 人 |
| 见闻 | 先图文；定位/心情以后 |
| 提醒 | 尽量订阅消息 + 应用内降级 |
| 技术 | 原生 + 云开发 |
| 待办 | **v1 包含**，带优先级 |
| 工程 | 基于现有 `hello-share` 扩展 |
