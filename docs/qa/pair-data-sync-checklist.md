# 配对后数据同步 — 手工验收清单

> 适用仓库：`liangkang233/dual-journal`  
> 相关：`docs/qa/p0-pair-checklist.md`（若存在）、PR #2/#3 配对同步修复、Tab 页 SWR / `pairEpoch`  
> 背景：真实邀请码加入后「好像没效果」——重点验双方 `pairId` 一致、列表按新 pair 拉取、开发版假搭档不堵死真实加入。

## 前置

- **开发版**编译（「我们」页 debug / 「模拟第二人加入」仅 develop）。
- `config.local.js`：`dataBackend` 为 `cloud` 或 `http`（http 需本地 `8787`）。
- 真机两微信号，或两套调试 openid / `x-openid`。
- 每条用例前清理该 openid 相关脏 `pairs`（及可选旧 entries）。
- 观察点：「我们」debug 的 `pairId`、`memberCount`、`pairEpoch`（若有）；见闻 / 待办 / 纪念列表。

## 通过定义

某条用例连续 **2 次**按「通过标准」通过，且 cloud / http（若该能力两边都有）至少各跑相关路径一遍无回归。

---

## TC-SYNC-1　真实双人邀请码：双方 pairId 一致 + 三列表按新 pair 拉数

**覆盖**：用户反馈「朋友绑码没效果」主路径。

### 步骤

1. 账号 A、B 冷启动；确认各自可进「我们」（solo 或未满员均可，按当前产品）。
2. A 生成邀请码并复制；记下 A 的 `pairId_A`。
3. B 输入码 →「加入配对」，应 Toast「加入成功」。
4. 立刻看 B debug：`pairId` 是否等于 `pairId_A`，`memberCount` 是否为 2。
5. A 在见闻写 `A-sync-entry`，待办写 `A-sync-todo`，纪念写 `A-sync-anni`。
6. B **不杀进程**，依次打开见闻 / 待办 / 纪念 Tab。
7. A 再切同样三个 Tab，确认也能看到自己刚写的（及若 B 已写则共享）。

### 通过标准

- B 加入成功；双方 `pairId` **相同**且稳定（切 Tab / 再进「我们」不漂回旧 solo）。
- B 第一次进入见闻 / 待办 / 纪念即可看到 A 的 `A-sync-*`（按新 `pairId` 查询）。
- A 侧 `memberCount=2`（可能需短等轮询或下拉；若产品有邀请方轮询，停留「我们」也应更新）。

### 失败常见原因

- 云函数 `acceptInvite` 未部署 / 旧逻辑。
- `getMyPair` 仍 `limit(1)` 抽到旧 solo。
- 列表仍用旧 `globalData.pairId`；`pairEpoch` 未递增。

| 日期 | 后端 | 结果 | 备注 |
|------|------|------|------|
|      |      |      |      |

---

## TC-SYNC-2　开发版假 id / `simulateDevPartner` 单机验证

**覆盖**：单机看「满员 UI」与列表刷新，不依赖第二台真机。

### 步骤（仅 cloud + develop）

1. `dataBackend: 'cloud'`，开发版，账号 A 进「我们」。
2. 确认 debug 面板有「模拟第二人加入」。
3. 点模拟；Toast「已模拟双人」；`memberCount=2`；`memberOpenids` 含 `dev_partner_*`。
4. 可选：在见闻写一条，切出再切回，确认列表仍按当前 `pairId` 加载（配合 SWR：可先短暂展示缓存再刷新，但不应空白卡死或串到别的 pair）。
5. `dataBackend: 'http'` 重复步骤 3：预期明确失败或不支持（与产品说明一致）。

### 通过标准

- cloud develop：模拟成功，UI 呈双人；`pairId` 仍是 A 的 pair；debug 可区分假成员。
- HTTP：行为与文档一致（不支持或提供等价假 id 说明），不静默假成功。
- 模拟后切 Tab 无「空闪后错数据」；若启用 SWR，过期重拉应对当前 `pairId`。

| 日期 | 后端 | 结果 | 备注 |
|------|------|------|------|
|      |      |      |      |

---

## TC-SYNC-3　假搭档不能堵死后续真实用户加入

**覆盖**：`dev_partner_*` 占满 2 人后真实第二人无法加入的问题。

### 步骤

1. A 开发版执行「模拟第二人加入」，`memberCount=2`。
2. A 尝试「生成邀请码」。
3. 若步骤 2 失败：执行「清除模拟搭档」（或等价：真实 accept 自动踢掉 `dev_partner_*`），再生成码。
4. 真实账号 C（或另一 openid）用该码加入。
5. 确认 pair 成员为真实 A+C，**不含** `dev_partner_*`；双方 `pairId` 一致。

### 通过标准

- 存在明确路径让真实第二人加入成功：清除按钮，或 accept 时自动踢假成员。
- 加入后 `memberOpenids` 仅真实用户；满员邀请关闭。
- 不允许「模拟后永久无法发码 / 无法真实加入」且无出口。

### 现状注意

若当前分支仅有 `simulateDevPartner`、无清除 / 无踢假成员，本条记 **FAIL**，并开修复后再验。

| 日期 | 后端 | 结果 | 备注 |
|------|------|------|------|
|      |      |      |      |

---

## TC-SYNC-4　加入后切 Tab：列表应对新 pair（配合 SWR / `pairEpoch`）

**覆盖**：accept 后只刷配对页时，见闻/待办/纪念是否仍拉旧 pair；以及 SWR 缓存是否串库。

### 步骤

1. B 在 solo 下（或旧 pair）先打开过见闻 Tab，使页面有一份「旧」列表缓存（SWR）。
2. B 用 A 的邀请码加入成功（`pairEpoch` 应 +1，若实现了）。
3. B 立刻切到见闻 → 待办 → 纪念（可快速来回切）。
4. 确认展示的是**双人 pair** 数据：能看到 A 预先写的 `A-sync-*`；不应长期停在只有 B-solo 的旧列表。
5. 弱网可选：观察是否先闪旧缓存再变为新 pair 数据；最终态必须是新 pair。

### 通过标准

- `pairId` 或 `pairEpoch` 变化后，三列表强制按新 pair 重拉（或 SWR 校验 key 含 pairId/epoch，过期后纠正）。
- 最终列表与 A 共享空间一致；无「UI 已配对、数据仍 solo」。
- 不要求必须 `switchTab` 自动跳转；但用户手动切 Tab 后第一次进入即应对。

| 日期 | 后端 | 结果 | 备注 |
|------|------|------|------|
|      |      |      |      |

---

## 建议执行顺序

1. TC-SYNC-1（cloud真机两账号）— 主路径  
2. TC-SYNC-4 — 紧接在 SYNC-1 的 B 加入后做  
3. TC-SYNC-2 → TC-SYNC-3 — 开发版假搭档链路  

HTTP：优先 SYNC-1 / SYNC-4；SYNC-2/3 仅在实现支持时跑。

## 与实现侧对齐的检查点

| 能力 | 建议位置 |
|------|----------|
| accept 成功写权威 `pairId` + `pair`，`pairEpoch++` | `pages/pair` / `adapters/*/pair.js` |
| 列表 onShow 比较 pairId/epoch | `pages/feed\|todos\|anniversaries` |
| SWR key 含 pair 维度 | 同上（PR SWR） |
| `simulateDevPartner` | `adapters/cloud/pair.js` |
| 清假成员 / accept 踢 `dev_partner_*` | 待实现或已有则写明入口 |
| 云函数与客户端同语义 | `cloudfunctions/acceptInvite` |

## 结案标准（数据同步专题）

- TC-SYNC-1、TC-SYNC-4：cloud 连续 2 次 PASS；http 至少 1 轮 PASS（若用 http）。  
- TC-SYNC-2：cloud develop PASS；http 行为符合说明。  
- TC-SYNC-3：PASS（假搭档可清或可被真实加入顶替）。  
满足后，「朋友绑码没效果」类问题才可从质检侧关闭。
