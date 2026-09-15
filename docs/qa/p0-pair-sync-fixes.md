# P0配对同步bug修复说明

## 修复概述

本次修复解决了双人见闻小程序中solo/dual配对状态同步的核心问题。

## 已修复的问题

### TC-P0-1: `ensureSolo` 阻止加入逻辑
**症状:** 用户可能在已有双人配对时创建冗余的solo pair。

**根本原因:** `getMyPair()` 使用 `.limit(1)` 无排序查询,当用户同时有solo和dual配对时,可能随机返回任一个。

**修复方案:**
1. `getMyPair()` 现在查询所有用户的pair,优先返回双人配对(memberOpenids.length >= 2)
2. 过滤掉已失效的solo pair(inviteActive=false且单人)
3. `ensureSolo()` 检测到双人配对时直接返回,不再创建新的solo

### TC-P0-2: pairId漂移问题
**症状:** 接受邀请后,客户端可能停留在错误的pairId上。

**根本原因:** 同TC-P0-1,`getMyPair()` 的随机性导致pairId不一致。

**修复方案:** 通过修复`getMyPair()`优先返回dual pair解决。

### TC-P0-3: 列表未按新pairId重新加载
**症状:** 接受邀请后,entries/todos/anniversaries列表仍显示旧数据。

**根本原因:** 三个页面的`onShow()`处理器会检查`app.globalData.pairId`并加载数据,但依赖`getMyPair()`返回正确的pairId。

**修复方案:** 
1. 修复`getMyPair()`确保返回正确的dual pairId
2. `acceptInvite`成功后调用`getMyPair()`更新globalData
3. 当用户切换tab时,各页面的`onShow()`自动使用新pairId加载数据

### TC-P0-5: 模拟伙伴不应阻止真实双人配对
**症状:** Solo pair(模拟的单人配对)可能阻止用户加入真实的双人配对。

**根本原因:** `acceptInvite`逻辑未区分solo和dual配对。

**修复方案:**
1. `acceptInvite`现在检查是否已在双人配对中,只有双人配对才阻止加入新配对
2. 接受邀请成功后,自动标记旧的solo pair为inactive(软删除)
3. 云函数和客户端逻辑保持一致

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
