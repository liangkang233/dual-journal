# 云数据库安全规则配置

本文档说明「双人见闻」小程序云数据库的推荐安全规则配置。

## 概述

为了让配对成员能够互相读写对方的数据，同时防止未授权访问，需要正确配置云数据库的权限规则。

## 推荐的数据库权限规则

### 1. `pairs` 集合

**读权限：** 仅创建者或配对成员可读
- 允许用户读取自己所在的配对记录（`memberOpenids` 字段包含当前用户 `openid`）

**写权限：** 仅创建者或配对成员可写
- 允许配对成员更新配对信息（背景主题等）
- **注意：邀请码接受操作强烈建议通过云函数完成**，避免客户端直接写入可能导致的权限问题

**示例规则（JSON）：**
```json
{
  "read": "doc.memberOpenids.indexOf(auth.openid) > -1",
  "write": "doc.memberOpenids.indexOf(auth.openid) > -1"
}
```

### 2. `entries` 集合（见闻记录）

**读权限：** 配对成员可读
- 允许读取配对内所有成员创建的见闻记录
- 规则：记录的 `pairId` 对应的 pair 的 `memberOpenids` 包含当前用户

**写权限：** 
- 创建：配对成员可创建
- 更新/删除：仅作者本人可操作

**推荐规则思路：**
```json
{
  "read": "get(`database.pairs.${doc.pairId}`).memberOpenids.indexOf(auth.openid) > -1",
  "write": "doc._openid == auth.openid"
}
```

**说明：**
- `read` 规则通过 `get()` 查询关联的 `pairs` 文档，检查当前用户是否在 `memberOpenids` 中
- `write` 规则限制只有记录创建者（`_openid` 为创建时自动记录的用户 openid）可以修改或删除

### 3. `todos` 集合（待办事项）

**权限要求：** 与 `entries` 类似
- 配对成员可读所有待办
- 只有创建者可以修改/删除自己创建的待办

**推荐规则：**
```json
{
  "read": "get(`database.pairs.${doc.pairId}`).memberOpenids.indexOf(auth.openid) > -1",
  "write": "doc._openid == auth.openid"
}
```

### 4. `anniversaries` 集合（纪念日）

**权限要求：** 与 `entries`、`todos` 类似
- 配对成员可读所有纪念日
- 只有创建者可以修改/删除

**推荐规则：**
```json
{
  "read": "get(`database.pairs.${doc.pairId}`).memberOpenids.indexOf(auth.openid) > -1",
  "write": "doc._openid == auth.openid"
}
```

### 5. `subscriptions` 集合（订阅消息授权记录）

**读权限：** 仅本人可读
**写权限：** 仅本人可写

**推荐规则：**
```json
{
  "read": "doc.openid == auth.openid",
  "write": "doc.openid == auth.openid"
}
```

## 重要提示

### 邀请码接受为什么要用云函数？

1. **权限隔离：** 朋友接受邀请时，可能还不在任何配对中，或只在自己的单人配对中。如果直接用客户端写入，可能因为数据库规则而无法：
   - 查询他人的邀请码（`inviteCode` 字段）
   - 更新他人配对的 `memberOpenids` 数组

2. **云函数优势：** 云函数运行在服务端，拥有完整的数据库访问权限（admin 权限），可以安全地：
   - 验证邀请码的有效性和过期时间
   - 将新成员添加到配对的 `memberOpenids`
   - 迁移单人配对的数据到新配对
   - 清理旧的单人配对记录

3. **当前实现：** `acceptInvite` 函数已优先调用云函数 `acceptInvite`，失败时才回退到本地直写（作为兼容性备用）。

## 配置步骤

1. 登录[微信云开发控制台](https://console.cloud.tencent.com/tcb)
2. 选择你的环境 → 数据库 → 选择对应集合
3. 点击「权限设置」
4. 根据上述推荐规则配置每个集合的读写权限
5. 保存并测试

## 测试建议

配置完成后，建议进行以下测试：

1. ✅ 单人可以创建自己的 pair
2. ✅ 通过云函数接受邀请码成功加入配对
3. ✅ 配对后双方都能看到对方的 entries/todos/anniversaries
4. ✅ 只能修改/删除自己创建的记录
5. ❌ 无法读取其他配对的数据
6. ❌ 无法修改他人创建的记录

## 常见问题

**Q: 为什么不让所有人都能读写？**  
A: 这样会导致隐私泄露，任何用户都能看到其他人的见闻和待办。

**Q: 如果规则配置错误会怎样？**  
A: 客户端操作可能会报权限错误，比如无法读取或写入数据。建议在开发环境先测试规则。

**Q: 云函数需要什么权限？**  
A: 云函数默认拥有 admin 权限，不受这些安全规则限制。这也是为什么邀请接受要用云函数的原因。

## 参考资料

- [微信小程序云开发文档 - 数据库权限控制](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/guide/database/security-rules.html)
- [云开发数据库安全规则表达式](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/reference-sdk-api/database/Database.RegExp.html)
