# TC-SYNC 测试用例对齐报告

**日期**: 2026-09-17  
**QA 文档**: `docs/qa/pair-data-sync-checklist.md` (PR #11)  
**对齐基础**: PR #2 Pair-Sync 修复 + PR #10 SWR/pairEpoch

---

## ✅ 测试用例对齐状态

### TC-SYNC-1: 真实双人邀请码 - 双方 pairId 一致 + 三列表按新 pair 拉数 ✅

**QA 要求**:
- 邀请码加入后双方 pairId 相同且稳定
- 三列表（见闻/待办/纪念）按新 pair 查询数据
- 切 Tab 不漂移回旧 solo

**实现对齐**:

#### ✅ TC-P0-1: Solo 不阻止加入
- **实现**: `acceptInviteLocal()` 区分 solo/dual
- **位置**: `adapters/cloud/pair.js`, `cloudfunctions/acceptInvite/index.js`, `server/src/index.js`
- **效果**: B 可以从 solo 状态接受 A 的邀请

#### ✅ TC-P0-2: pairId 稳定性
- **实现**: `getMyPair()` 优先返回 dual pair，使用 `inactivatedAt` 软删除 solo
- **位置**: `adapters/cloud/pair.js`, `server/src/index.js`
- **效果**: 加入后 pairId 不漂移，切 Tab 保持稳定

#### ✅ TC-P0-3: 列表自动重载
- **实现**: 通过 TC-P0-2 修复自动解决
- **位置**: `pages/feed/index.js`, `pages/todos/index.js`, `pages/anniversaries/index.js`
- **效果**: Tab 的 `onShow()` 使用新 pairId 加载数据

**代码验证**:
```javascript
// adapters/cloud/pair.js - getMyPair()
// 1. 查询所有包含用户的 pair
// 2. 过滤掉已软删除的 solo (单人且有 inactivatedAt)
// 3. 优先返回双人配对
const dualPair = pairs.find(p => p.memberOpenids.length >= 2)
return dualPair || pairs[0]
```

**测试验证**: ✅ `npm test` 全部通过

---

### TC-SYNC-2: 开发版 simulateDevPartner 单机验证 ✅

**QA 要求**:
- 开发版可模拟第二人加入
- memberCount = 2，UI 呈双人状态
- 切 Tab 列表仍按当前 pairId 加载

**实现对齐**:

#### ✅ simulateDevPartner 实现
- **位置**: `adapters/cloud/pair.js` - `simulateDevPartner()` 函数
- **功能**: 添加假 `dev_partner_*` 成员
- **限制**: 仅开发版 + cloud backend

**代码验证**:
```javascript
// adapters/cloud/pair.js
function simulateDevPartner() {
  const app = getApp()
  const isDev = !!(app && app.globalData && app.globalData.isDevBuild)
  if (!isDev) {
    return Promise.reject(new Error('仅开发版可用'))
  }
  return ensureSolo().then((pair) => {
    // ... 添加 dev_partner_* 成员
    const fake = 'dev_partner_' + String(Date.now()).slice(-8)
    members.push(fake)
    // ... 更新 pair
  })
}
```

#### ✅ HTTP 模式行为
- **位置**: `adapters/http/pair.js`
- **行为**: 返回明确错误提示
- **信息**: "HTTP 模式请用两个不同的 x-openid 测配对，或切 cloud 开发版模拟"

**文档**: ✅ `docs/qa/fake-id-testing.md` 详细说明

---

### TC-SYNC-3: 假搭档不能堵死后续真实用户加入 ✅

**QA 要求**:
- dev_partner_* 占满 2 人后，真实用户仍能加入
- 清除假成员或自动踢出机制
- 最终 memberOpenids 仅包含真实用户

**实现对齐**:

#### ✅ TC-P0-5: 自动清理假伙伴
- **实现**: accept 时检测并移除 `dev_partner_*` 成员
- **位置**: `adapters/cloud/pair.js`, `cloudfunctions/acceptInvite/index.js`
- **提交**: `f775d9f`

**代码验证**:
```javascript
// adapters/cloud/pair.js - acceptInviteLocal()
// 检查是否有模拟伙伴
const hasDevPartner = members.some(id => 
  typeof id === 'string' && id.startsWith('dev_partner_')
)

// 仅当真实满员时才拒绝
if (members.length >= 2 && !hasDevPartner) {
  return Promise.reject(new Error('配对已满员'))
}

// 移除模拟伙伴，为真实用户腾出位置
const realMembers = members.filter(id => 
  !(typeof id === 'string' && id.startsWith('dev_partner_'))
)
const nextMembers = realMembers.concat([openid])
```

**测试流程**:
1. A 使用 `simulateDevPartner` 创建假伙伴
2. A 生成邀请码
3. 真实用户 C 接受邀请
4. ✅ dev_partner_* 自动移除，C 成功加入

---

### TC-SYNC-4: 加入后切 Tab - 列表应对新 pair (配合 SWR / pairEpoch) ✅

**QA 要求**:
- accept 后 pairEpoch 递增
- 切 Tab 时列表按新 pairId 查询
- SWR 缓存 key 包含 pair 维度

**实现对齐**:

#### ✅ pairEpoch 实现 (PR #10)
- **初始化**: `app.js` - `pairEpoch: 0`
- **更新时机**: 
  - `pages/pair/index.js` line 290: 对方加入时 `pairEpoch++`
  - accept 成功后调用 `refresh()` 触发更新

**代码验证**:
```javascript
// pages/pair/index.js - refresh()
if (prevMemberCount < 2 && memberCount >= 2) {
  if (app.globalData) {
    app.globalData.pairEpoch = (app.globalData.pairEpoch || 0) + 1
  }
  wx.showToast({ title: '对方已加入', icon: 'success' })
  this.stopPollForJoin()
  this.setData({ _lastLoadedAt: 0 })
  this.refresh()
}
```

#### ✅ SWR key 包含 pairId
- **实现**: PR #10 - stale-while-revalidate
- **位置**: `pages/feed/index.js`, `pages/todos/index.js`, `pages/anniversaries/index.js`
- **效果**: pairId 变化时缓存失效，重新加载

#### ✅ accept 后立即刷新
```javascript
// pages/pair/index.js - acceptInvite()
pairService.acceptInvite(code)
  .then(() => {
    this.setData({ accepting: false, _lastLoadedAt: 0 })
    wx.showToast({ title: '加入成功', icon: 'success' })
    return this.refresh()  // ✅ 立即刷新，更新 pairId 和 pairEpoch
  })
```

---

## 📊 实现对齐矩阵

| TC-SYNC | QA 要求 | 对应 PR #2 修复 | 代码位置 | 状态 |
|---------|---------|----------------|----------|------|
| **TC-SYNC-1** | 双方 pairId 一致 + 三列表 | TC-P0-1, P0-2, P0-3 | adapters/cloud/pair.js, cloudfunctions/acceptInvite, server/src/index.js | ✅ |
| **TC-SYNC-2** | simulateDevPartner | 已实现 | adapters/cloud/pair.js, docs/qa/fake-id-testing.md | ✅ |
| **TC-SYNC-3** | 假搭档清理 | TC-P0-5 | adapters/cloud/pair.js, cloudfunctions/acceptInvite | ✅ |
| **TC-SYNC-4** | Tab 切换 + pairEpoch | PR #10 SWR | pages/pair/index.js, pages/*/index.js, app.js | ✅ |

---

## 🔍 关键实现检查点

### ✅ accept 成功写权威 pairId + pair，pairEpoch++
- **位置**: `pages/pair/index.js` - `acceptInvite()` → `refresh()`
- **实现**: line 290 - `app.globalData.pairEpoch++`

### ✅ 列表 onShow 比较 pairId/epoch
- **位置**: `pages/feed/index.js`, `pages/todos/index.js`, `pages/anniversaries/index.js`
- **实现**: onShow 调用 load 函数，检查 pairId

### ✅ SWR key 含 pair 维度
- **实现**: PR #10 - stale-while-revalidate
- **效果**: pairId 变化时缓存失效

### ✅ simulateDevPartner
- **位置**: `adapters/cloud/pair.js`
- **限制**: 开发版 + cloud backend

### ✅ 清假成员 / accept 踢 dev_partner_*
- **位置**: `adapters/cloud/pair.js` - `acceptInviteLocal()`
- **位置**: `cloudfunctions/acceptInvite/index.js`
- **实现**: 检测并过滤 `dev_partner_*` 前缀

### ✅ 云函数与客户端同语义
- **位置**: `cloudfunctions/acceptInvite/index.js`
- **对齐**: 与 `acceptInviteLocal()` 逻辑一致

---

## 📄 相关文档

1. **QA 测试清单**: `docs/qa/pair-data-sync-checklist.md` (PR #11) ✅
2. **P0 修复详情**: `docs/qa/p0-pair-sync-fixes.md` ✅
3. **Fake-ID 测试**: `docs/qa/fake-id-testing.md` ✅
4. **完成报告**: `COMPLETION_REPORT.md` ✅

---

## ✅ 结案确认

### TC-SYNC 测试用例全部对齐 ✅

- ✅ **TC-SYNC-1**: 基于 TC-P0-1, P0-2, P0-3 实现
- ✅ **TC-SYNC-2**: simulateDevPartner 已实现
- ✅ **TC-SYNC-3**: TC-P0-5 自动清理假伙伴
- ✅ **TC-SYNC-4**: PR #10 pairEpoch + SWR

### 代码验证 ✅
- ✅ 所有测试通过 (`npm test`)
- ✅ PR #2 已合并到 master (f775d9f)
- ✅ PR #10 已合并到 master (cb0718c)
- ✅ PR #11 已合并到 master (最新)

### 文档完整 ✅
- ✅ 4 份 QA 文档全部就位
- ✅ TC-P0-1~5 完整实现
- ✅ TC-SYNC-1~4 完全对齐

---

**报告生成**: 2026-09-17  
**状态**: ✅ 所有测试用例已对齐并合并到 master
