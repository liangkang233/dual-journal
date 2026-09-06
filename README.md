# 双人见闻（hello-share）

微信原生小程序：双人邀请配对、图文见闻、带优先级待办、纪念日（应用内 + 订阅消息）、可换空间背景。

数据层支持 **云开发** 与 **自建 HTTP API** 切换（默认云开发）。

AppID：`wxe973b8825d2d5991`

---

## 1. 数据后端切换

配置文件：`config/index.js`

```js
module.exports = {
  dataBackend: 'cloud', // 或 'http'
  cloudEnvId: 'test1-d3gl4me5obe3f13ce',
  httpBaseUrl: '',      // 自建 API 根地址，无 trailing slash
}
```

| `dataBackend` | 行为 |
|---------------|------|
| `'cloud'`（默认） | `app.js` 初始化微信云开发；`services/*` 走 `adapters/cloud/`（云函数 + 云数据库/存储） |
| `'http'` | 不初始化云开发；`services/*` 走 `adapters/http/`，用 `wx.request` / `wx.uploadFile` 调用 `httpBaseUrl` |

切换步骤：

1. 改 `config/index.js` 的 `dataBackend`。
2. 若用 HTTP：填写 `httpBaseUrl`（需在小程序后台配置合法 request / uploadFile 域名），并确保自建服务实现与 adapter 相同的接口形状（见 `adapters/http/*.js`）。
3. 重新编译。页面仍只 `require('../../services/...')`，无需改业务页。

当前云环境 ID：`test1-d3gl4me5obe3f13ce`（已写入 `config/index.js` 与 `app.js`）。

---

## 2. 创建云数据库集合（仅 cloud 后端）

在云开发控制台 → 数据库中新建以下集合（名称需一致）：

| 集合 | 用途 |
|------|------|
| `pairs` | 配对空间、邀请码、背景 |
| `entries` | 见闻图文 |
| `todos` | 双人待办 |
| `anniversaries` | 纪念日 |
| `subscriptions` | 订阅消息授权记录 |

建议权限：仅创建者可读写，或按业务配置「仅 pair 成员可读写本 pair 数据」（生产环境务必收紧）。

索引建议：`entries.pairId + createdAt`、`todos.pairId`、`anniversaries.pairId`、`subscriptions.openid + pairId + templateId`。

---

## 3. 部署云函数（仅 cloud 后端）

在微信开发者工具中，右键下列目录分别「上传并部署：云端安装依赖」：

- `cloudfunctions/login`
- `cloudfunctions/createInvite`
- `cloudfunctions/acceptInvite`
- `cloudfunctions/onAnniversaryTick`

部署后确认云端可调用；客户端通过 `wx.cloud.callFunction` 使用同名函数。

---

## 4. 订阅消息模板 ID

1. 在微信公众平台 / 小程序后台申请「订阅消息」模板，记下模板 ID。
2. 替换两处占位符 `SUBSCRIBE_TMPL_ID`：
   - `pages/pair/index.js`（用户授权写入 `subscriptions`）
   - `cloudfunctions/onAnniversaryTick/index.js`（定时推送）
3. 「我们」页引导用户点击「开启订阅消息提醒」完成授权。

授权失败或发送失败会静默降级为仅应用内「今日纪念」提醒，不阻断其他功能。

---

## 5. 定时触发器（纪念日推送）

`onAnniversaryTick` 已在 `config.json` 中声明示例触发器（每天 09:00）：

```json
"config": "0 0 9 * * * *"
```

上传云函数后，在云开发控制台 → 云函数 → `onAnniversaryTick` → 触发器中确认定时器已生效；也可按需调整 cron。

---

## 6. 空间背景

在「我们」页（已创建/加入配对后）：

- 预设主题：`warm`（暖阳）/ `mint`（薄荷）/ `night`（夜色）/ `plain`（简白）
- 自定义图：云后端上传至云存储 `pairs/{pairId}/background.jpg`；HTTP 后端走 `PUT/upload /api/pairs/:id/background`

见闻 / 待办 / 纪念 / 我们 等主页面会读取 `pair.background` 应用 CSS 类或自定义 `backgroundImage`。

---

## 7. 体验版发布步骤

1. 确认 `config/index.js`：`dataBackend`、`cloudEnvId`（或 `httpBaseUrl`）、建集合、部署云函数、替换订阅模板 ID、确认定时触发器。
2. 开发者工具用真机预览验证配对、见闻上传、待办、纪念日横幅。
3. 上传代码：开发者工具点击「上传」，填写版本号与备注。
4. 登录微信公众平台 → 管理 → 版本管理 → 开发版本 → **选为体验版**。
5. 将体验版二维码发给体验者（需先在「成员管理」中添加体验成员）。
6. 两人用不同微信号：一方生成邀请码并分享，另一方输入码或点分享链接完成配对，再验证见闻/待办/背景同步。

---

## 本地单测（utils）

见 package.json scripts；可分别运行 tests 目录下的用例。

---

## 目录速览

- app.js / app.json / app.wxss
- config/index.js  (dataBackend / cloudEnvId / httpBaseUrl)
- pages/
- services/  (facade)
- adapters/cloud/
- adapters/http/
- utils/
- cloudfunctions/
- server/
- docs/
