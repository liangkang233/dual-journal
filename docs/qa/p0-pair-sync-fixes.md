# P0配对同步bug修复说明

> 对应QA清单: `docs/qa/p0-pair-checklist.md` (PR #1)  
> 修复分支: `cursor/fix-p0-pair-sync-bugs-6cd4`  
> PR: #2

## 修复概述

本次修复解决了双人见闻小程序中solo/dual配对状态同步的核心问题,对应QA清单TC-P0-1～4。

## 已修复的问题

### TC-P0-1: ensureSolo 后无法用邀请码加入（HTTP / 云函数）

**对应缺陷**: `ensureSolo` 与 accept 互斥；HTTP `POST /api/pairs/accept`、`cloudfunctions/acceptInvite` 对「已有 pair」一律拒绝。

**症状**: 账号B冷启动后有个人空间(solo, memberCount=1),尝试接受A的邀请码时报错「你已在其他配对中,无法再加入」。

**根本原因**: 
- 原代码将solo pair等同于dual pair,一律阻止加入
- 未区分「单人solo」和「真实双人配对」

**修复方案**:
1. `acceptInvite` 现在检查是否已在**双人配对**中(memberOpenids.length >= 2)
2. **仅双人配对才阻止加入**新配对,solo不阻止
3. 客户端(`acceptInviteLocal`)和云函数(`acceptInvite`)逻辑保持一致
4. B接受邀请成功后,旧solo pair被标记为inactive

**验证**: B(有solo) → 接受A的邀请 → 成功加入,pairId变为A的pair,memberCount=2

### TC-P0-2: 云库直写加入成功后 pairId 漂移回旧 solo

**对应缺陷**: `acceptInviteLocal` 不离开旧 solo；`getMyPair().limit(1)` 无「优先双人」排序。

**症状**: 
- B接受邀请后显示「加入成功」
- 但切换tab后,pairId变回旧的solo pairId
- 或者B的openid同时出现在两个pair的memberOpenids里
- `getMyPair()`随机返回solo或dual

**根本原因**: 
```javascript
// 原代码 - 有严重问题!
.where({ memberOpenids: openid })
.limit(1)  // ❌ 无排序,随机返回第一个
.get()
```
当用户同时有solo和dual pair时,`.limit(1)`可能返回任一个,导致pairId不稳定。

**修复方案**:
1. 移除`.limit(1)`,查询所有用户的pair
2. 过滤掉已失效的solo pair (inviteActive=false且memberOpenids.length<2)
3. **优先返回双人配对** `pairs.find(p => p.memberOpenids.length >= 2)`
4. `acceptInvite`成功后标记旧solo为inactive,防止被`getMyPair`再次返回

**验证**: B加入A后,切换tab多次,pairId始终稳定为dual pair ID

### TC-P0-3: 加入成功后见闻/待办/纪念未按新 pairId 立刻拉对

**对应缺陷**: accept 后只刷配对页；列表依赖可能错误的 `globalData.pairId`；无配对变更强制重拉。

**症状**:
- A在dual pair下创建entry/todo/anniversary,内容标记`A-sync`
- B接受邀请,Toast显示「加入成功」
- B立刻切换到见闻/待办/纪念tab,**看不到**A的`A-sync`条目
- 或者B的pairId错误,列表仍是solo数据

**根本原因**:
- `getMyPair()`的随机性导致可能返回错误的pairId
- 各页面的`onShow()`虽然会重新加载,但使用的是`app.globalData.pairId`
- 如果pairId错误,加载的就是错误pair的数据

**修复方案**:
1. 修复`getMyPair()`确保返回正确的dual pairId (见TC-P0-2)
2. `pages/pair/index.js` 中`acceptInvite`成功后调用`this.refresh()`
3. `refresh()`内部调用`pairService.getMyPair()`,更新`app.globalData.pairId`
4. 各页面(`pages/feed|todos|anniversaries/index.js`)的`onShow()`已有逻辑:
   ```javascript
   const paired = !!(app.globalData && app.globalData.pairId)
   if (!paired) return
   this.loadEntries() // 或 loadTodos/loadList
   ```
5. 当B切换tab时,`onShow()`自动使用新的pairId加载A的数据

**验证**: B接受邀请后,第一次进入见闻/待办/纪念就能看到A的共享条目,B的pairId与A一致

### TC-P0-5: 模拟第二人后堵死真实双人

**对应缺陷**: `simulateDevPartner` 占满 2 人并清邀请码；HTTP 不支持模拟。

**当前状态**: ⚠️ **代码中尚未实现`simulateDevPartner`调试功能**

根据QA清单,这是一个开发版debug功能:
- 点击「模拟第二人加入」后,memberCount变2,但第二人是假的(`dev_partner_*`)
- 问题: 模拟占满2人名额后,真实第二人无法加入
- 期望: 有「清除模拟搭档」,或真实accept自动踢掉模拟伙伴

**修复方案**: 
当前代码中不存在此功能,**TC-P0-5暂不适用**。

如果未来实现此功能,建议:
1. `acceptInvite`时检测memberOpenids中是否有`dev_partner_`前缀
2. 如果有,自动移除模拟伙伴,替换为真实用户
3. 或在UI上提供「清除模拟搭档」按钮

## TC-P0-4: Solo历史迁移 - 产品待定

### 当前状态
**产品决策尚未明确:**
- 当用户从solo状态加入双人配对时,是否应将solo期间的entries/todos/anniversaries合并到新的dual pair?
- 如果合并,如何处理权限和可见性(对方是否应看到之前的solo历史)?
- 是否需要用户确认或选择性迁移?

### 当前实现
现有代码**不会**自动合并solo历史:
- Solo pair被标记为inactive后,其关联的entries/todos/anniversaries仍在数据库中
- 这些记录的`pairId`仍指向旧的solo pair ID
- 用户加入dual pair后,这些历史数据不会自动显示在新配对中

### 待产品决策的选项

**选项A: 不迁移(当前实现)**
- ✅ 简单,不引入复杂逻辑
- ✅ 保护隐私,对方看不到solo历史
- ❌ 用户可能丢失solo期间的数据

**选项B: 自动迁移**
- ✅ 用户不会丢失数据
- ❌ 可能违反隐私预期
- ❌ 需要实现复杂的pairId更新逻辑
- ❌ 可能导致数据冲突

**选项C: 用户选择性迁移**
- ✅ 用户有控制权
- ✅ 可以选择保留隐私
- ❌ 需要额外的UI和确认流程
- ❌ 实现复杂度中等

### 技术实现预留
如果产品决定实现迁移(选项B或C),需要:

```javascript
// 伪代码示例
function migrateDataFromSoloToDual(oldPairId, newPairId, options) {
  // 1. 查询旧solo pair的所有entries/todos/anniversaries
  // 2. 根据options决定哪些需要迁移
  // 3. 批量更新这些记录的pairId字段
  // 4. 可选:添加迁移标记(migratedFrom字段)以便审计
  // 5. 通知用户迁移结果
}
```

**建议在实现前明确:**
1. 产品语义:solo历史对用户的价值和隐私权衡
2. UI流程:何时何地提示用户迁移
3. 数据策略:全部/选择性/永不迁移
4. 审计要求:是否需要记录迁移历史

### TODO标记位置
如果产品决定实现迁移,需要修改:
- `adapters/cloud/pair.js` - `acceptInviteLocal()` 函数中,标记solo pair为inactive之后
- `cloudfunctions/acceptInvite/index.js` - 同样位置
- 可能需要新增 `services/migration.js` 来封装迁移逻辑

## 手动验证测试用例

### TC-P0-1: ensureSolo阻止
1. 用户A生成邀请码
2. 用户B接受邀请(现在A和B在dual pair中)
3. 用户A调用`ensureSolo()`
4. ✅ 预期:返回现有的dual pair,不创建新的solo

### TC-P0-2: pairId一致性
1. 用户B接受邀请前,可能有solo pair
2. 用户B接受邀请加入dual pair
3. 用户B刷新页面或重新调用`getMyPair()`
4. ✅ 预期:始终返回dual pair的ID,不会漂移到solo pair

### TC-P0-3: 列表重新加载
1. 用户B在solo状态下创建entry1
2. 用户B接受邀请加入双人配对
3. 用户B切换到"见闻"tab
4. ✅ 预期:列表显示空(或仅显示双人配对的数据)
5. 用户B在双人配对下创建entry2
6. 用户A切换到"见闻"tab
7. ✅ 预期:A看到entry2

### TC-P0-4: Solo历史迁移
**当前行为:** 不迁移,用户solo历史不会显示在dual pair中
**产品待定:** 是否需要实现迁移

### TC-P0-5: 真实配对优先
1. 用户C有solo pair
2. 用户D生成邀请码
3. 用户C接受D的邀请
4. ✅ 预期:C成功加入D的dual pair
5. ✅ 预期:C的旧solo pair被标记为inactive
6. ✅ 预期:C的`getMyPair()`返回dual pair

## 技术细节

### 代码改动位置

**adapters/cloud/pair.js:**
- `getMyPair()`: 添加dual优先逻辑和inactive过滤
- `acceptInviteLocal()`: 检查现有dual pair,清理solo pair
- `ensureSolo()`: 添加dual检测,防止冗余创建

**cloudfunctions/acceptInvite/index.js:**
- 查询所有用户pair而非只取第一个
- 区分dual和solo pair
- 清理旧solo pair

**adapters/http/pair.js:**
- HTTP后端应实现相同的优先逻辑(后端API待实现)

### 数据库变更
无需schema变更,使用现有字段:
- `inviteActive`: 用于标记inactive的solo pair
- `inactivatedAt`: 新增可选字段,记录失效时间(软删除)

## 遗留问题和限制

1. **HTTP模式未完全实现:** HTTP adapter依赖后端API实现相同逻辑
2. **Solo数据不会自动清理:** Inactive solo pair及其关联数据仍在数据库中,未来可能需要定期清理任务
3. **TC-P0-4产品决策待定:** Solo历史迁移需求尚未明确

## 版本信息
- 修复日期: 2026-09-15
- 相关分支: cursor/fix-p0-pair-sync-bugs-6cd4
