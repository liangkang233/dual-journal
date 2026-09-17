# P0 配对同步 — 手工验收清单

> 适用仓库：`liangkang233/dual-journal`（本地路径常为 `hello-share`）  
> 用途：修完 P0 配对 bug 后的回归验收；当前代码预期按「现状」列失败。  
> 产品待定：P0-4（solo 历史是否合并进双人 pair）需产品拍板；若不合并则降级并改文档预期。

## 前置

- 使用**开发版**编译（「我们」页才有 debug 面板与「模拟第二人加入」）。
- 后端切换：改 `config.local.js` 的 `dataBackend` 为 `cloud` 或 `http`（http 需本地 `8787` 服务可用）。
- 准备账号 A / B：真机两微信号；或云开发两模拟 openid；HTTP 用两套 `x-openid`。
- **每条用例前**清理该 openid 在 `pairs`（及可选 entries / todos / anniversaries）中的旧数据，避免脏 pair。
- 观察点：「我们」页 debug 的 `pairId`、`memberCount`、backend；见闻 / 待办 / 纪念列表内容。

## 建议执行顺序

`TC-P0-1`（HTTP）→ `TC-P0-2`（cloud）→ `TC-P0-3` → `TC-P0-4` → `TC-P0-5`。  
若 1/2 不过，「成功加入」前置不成立，3/4 记为**阻断**，不要标通过。

## 通过定义

某条 P0 算修完：对应用例连续 **2 次**按「通过标准」通过，且另一后端（cloud / http）相关路径至少各跑一遍无回归。

---

## TC-P0-1　ensureSolo 后无法用邀请码加入（HTTP / 云函数）

**对应缺陷**：`ensureSolo` 与 accept 互斥；HTTP `POST /api/pairs/accept`、`cloudfunctions/acceptInvite` 对「已有 pair」一律拒绝。

### 步骤

1. 设 `dataBackend: 'http'`（或 cloud，并让 accept 落到云函数）。
2. 账号 B 冷启动小程序，进「我们」，确认已有个人空间（`memberCount=1`）。
3. 账号 A 生成邀请码并复制。
4. 账号 B 在「输入邀请码加入」填 A 的码，点「加入配对」。

### 现状预期

- Toast / 错误为「你已在其他配对中，无法再加入」。
- B 的 `pairId` 仍是自己的 solo。

### 通过标准

- B 加入成功。
- `pairId` 变为 A 的 pair；`memberCount=2`。
- 不再报「已在其他配对」。

| 日期 | 后端 | 结果 (pass/fail/blocked) | 备注 |
|------|------|--------------------------|------|
|      |      |                          |      |

---

## TC-P0-2　云库直写加入成功后 pairId 漂移回旧 solo

**对应缺陷**：`acceptInviteLocal` 不离开旧 solo；`getMyPair().limit(1)` 无「优先双人」排序。

### 步骤

1. 设 `dataBackend: 'cloud'`，库直写可用。
2. A、B 各冷启动一次，各自确保已有 solo；debug 记下 B 的旧 `pairId_solo`。
3. A 生成邀请码；B 输入并「加入配对」，应出现「加入成功」。
4. 立刻看 B 的 debug：`pairId` 是否已是 A 的 pair。
5. B 切到「见闻」再切回「我们」，或下拉 / 再进一次「我们」。
6. 云库查 `pairs`：B 的 openid 是否仍同时出现在两个 pair 的 `memberOpenids` 里。

### 现状预期

- 步骤 3 可能成功，但步骤 5 后 `pairId` 变回 `pairId_solo`，`memberCount` 变 1。
- 或 UI 像已配对，列表仍是单人空间。

### 通过标准

- 全程 `pairId` 稳定为双人 pair。
- B 旧 solo 已删除或已无 B。
- `getMyPair` 不会再抽到旧 solo。

| 日期 | 后端 | 结果 | 备注 |
|------|------|------|------|
|      |      |      |      |

---

## TC-P0-3　加入成功后见闻/待办/纪念未按新 pairId 立刻拉对

**对应缺陷**：accept 后只刷配对页；列表依赖可能错误的 `globalData.pairId`；无配对变更强制重拉。

### 步骤

1. 在能真正加入的前提下（已修 P0-1/2，或人为清掉 B 的 solo 再 accept）。
2. A 在双人 pair 下先写 1 条见闻、1 条待办、1 条纪念（内容带标记如 `A-sync`）。
3. B 用邀请码加入成功（Toast「加入成功」）。
4. 不杀进程：B 立刻依次打开见闻、待办、纪念 Tab。
5. 可选：B 一直停在「我们」；A 再新写一条；B 再切 Tab 看是否出现。

### 现状预期

- B 加入后若未切 Tab，其它页不更新。
- 若 `pairId` 仍错，切 Tab 也看不到 `A-sync`。

### 通过标准

- B 加入成功后，第一次进入见闻 / 待办 / 纪念就能看到 A 的共享条目。
- B 的 `pairId` 与 A 一致。

| 日期 | 后端 | 结果 | 备注 |
|------|------|------|------|
|      |      |      |      |

---

## TC-P0-4　solo 历史不随真实配对迁移

**对应缺陷**：accept 无 `pairId` 批量迁移；写入一律带当前 `globalData.pairId`。

**产品待定**：若期望「合并成一份见闻本」则本条保持 P0；若明确「solo 历史不合并」则降级并改通过标准为文档化预期。

### 步骤

1. B 仅在 solo 下写见闻 `B-solo-entry`、待办 `B-solo-todo`、纪念 `B-solo-anni`，记下当时 `pairId_solo`。
2. B 成功加入 A 的双人 pair（`pairId_dual`）。
3. 在双人 pair 下看 B 与 A 的三列表是否出现上述三条。
4. 库中查这三条文档的 `pairId` 字段。

### 现状预期

- 列表在 `pairId_dual` 下看不到 B 的旧三条。
- 文档仍挂 `pairId_solo`。

### 通过标准（合并策略）

- accept 后三条的 `pairId` 变为 `pairId_dual`，双方列表都能看到。
- 旧 solo 已清理。

| 日期 | 后端 | 结果 | 产品策略 (merge/keep) | 备注 |
|------|------|------|------------------------|------|
|      |      |      |                        |      |

---

## TC-P0-5　模拟第二人后堵死真实双人

**对应缺陷**：`simulateDevPartner` 占满 2 人并清邀请码；HTTP 不支持模拟。

### 步骤

1. 设 `dataBackend: 'cloud'`，开发版，账号 A 进入「我们」。
2. 点 debug「模拟第二人加入」，Toast「已模拟双人」，`memberCount=2`。
3. A 再点「生成邀请码」。
4. 另开账号 C（真实第二人）尝试加入 A 的 pair（若步骤 3 失败则已堵死）。
5. 切换 `dataBackend: 'http'`，重复步骤 2。

### 现状预期

- cloud：步骤 3 满员失败；真实 C 无法加入。
- HTTP：步骤 2 报「当前后端不支持模拟配对」。

### 通过标准

- 有「清除模拟搭档」，或真实 accept 自动踢掉 `dev_partner_*`。
- 清除后可生成码并让真实第二人加入。
- HTTP 与 cloud 行为说明一致（支持或明确禁用）。

| 日期 | 后端 | 结果 | 备注 |
|------|------|------|------|
|      |      |      |      |

---

## 修完建议回归范围（给开发）

优先改法验收顺序：

1. accept 把「仅自己的 solo」视为可离开状态（离开 / 合并成员）。
2. `getMyPair` 多结果时优先 `memberOpenids.length >= 2`（或最新 `updatedAt`）。
3. accept 成功后强制以权威 `pairId` 覆盖 `globalData`，并触发见闻 / 待办 / 纪念重拉。
4. （若产品选 merge）accept 事务内迁移三集合 `pairId` 并清理 solo。
5. 模拟搭档可清除，或不占真实满员名额；真实 accept 踢掉 `dev_partner_*`。

相关路径（审计时）：`app.js` `ensureLogin`、`adapters/cloud/pair.js`、`adapters/http/pair.js`、`cloudfunctions/acceptInvite`、`server/src/index.js` accept、`pages/pair|feed|todos|anniversaries/index.js` `onShow`。
