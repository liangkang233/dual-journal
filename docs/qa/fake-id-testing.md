# 假ID测试指南 (Fake ID Testing)

本文档说明如何在单设备环境下使用假ID进行双人配对测试。

## 方法 1: simulateDevPartner (开发版 + Cloud)

**适用场景**: 
- 微信开发者工具
- `dataBackend: 'cloud'`
- 开发版编译

**步骤**:

1. 在 `config.local.js` 设置：
```javascript
module.exports = {
  dataBackend: 'cloud',
  // ... 其他配置
}
```

2. 账号A进入「我们」页面，点击debug区域的「模拟第二人加入」按钮

3. Toast显示「已模拟双人」，此时:
   - `memberCount = 2`
   - `memberOpenids` 包含一个 `dev_partner_*` 前缀的假ID
   - 可以验证双人配对的UI和数据

4. **真实用户加入时自动清理**: 
   - 账号B通过邀请码加入时，`dev_partner_*` 成员会被自动移除
   - B成功加入后，pair中只有A和B两个真实用户

**代码位置**: `adapters/cloud/pair.js` - `simulateDevPartner()`

## 方法 2: HTTP 模式下使用不同 x-openid

**适用场景**:
- 本地HTTP服务器测试
- `dataBackend: 'http'`
- 单设备模拟双人

**步骤**:

1. 在 `config.local.js` 设置：
```javascript
module.exports = {
  dataBackend: 'http',
  httpServerBaseUrl: 'http://localhost:3000/api',
  // ... 其他配置
}
```

2. 修改 `adapters/http/index.js`，在请求头中添加不同的 `x-openid`：

```javascript
// 用户A的请求
wx.request({
  // ...
  header: {
    'x-openid': 'test-user-a',
    'Content-Type': 'application/json'
  }
})

// 用户B的请求（在另一个session或修改代码后）
wx.request({
  // ...
  header: {
    'x-openid': 'test-user-b',
    'Content-Type': 'application/json'
  }
})
```

3. 或使用 API 测试工具（Postman / curl）直接测试：

```bash
# 用户A创建邀请码
curl -X POST http://localhost:3000/api/pairs/invite \
  -H "Content-Type: application/json" \
  -H "x-openid: test-user-a"

# 用户B接受邀请
curl -X POST http://localhost:3000/api/pairs/accept \
  -H "Content-Type: application/json" \
  -H "x-openid: test-user-b" \
  -d '{"inviteCode":"ABC123"}'

# 验证双方的pair
curl http://localhost:3000/api/pairs/me -H "x-openid: test-user-a"
curl http://localhost:3000/api/pairs/me -H "x-openid: test-user-b"
```

**注意**: HTTP adapter 的 `simulateDevPartner` 会返回错误提示，建议使用上述方法。

## 测试清单

使用假ID测试时，应验证以下场景：

### ✅ 基础配对
- [ ] 用户A创建个人空间（solo pair）
- [ ] 用户A生成邀请码
- [ ] 用户B接受邀请码
- [ ] 双方pairId一致
- [ ] memberCount = 2

### ✅ 数据同步
- [ ] 用户A创建见闻/待办/纪念
- [ ] 用户B能看到A的内容
- [ ] 用户B创建内容，A能看到
- [ ] pairId标记正确

### ✅ Tab切换（如果 #10 已合并）
- [ ] 切换Tab时保持SWR行为
- [ ] 不会出现空白闪烁

### ✅ TC-P0-5: 模拟伙伴清理
- [ ] 使用 `simulateDevPartner` 创建假伙伴
- [ ] 真实用户B能成功加入（自动清理假伙伴）
- [ ] 最终pair中只有真实用户

## 真实双设备测试

虽然假ID测试很方便，但**生产环境验证**应使用两个真实微信账号：

1. 两台手机，或手机+模拟器
2. 两个不同的微信账号
3. 验证完整的邀请码流程
4. 验证推送通知（如果有）
5. 验证网络断线重连场景

## 故障排查

### simulateDevPartner 不可用
- 确认是**开发版**而非体验版或正式版
- 确认 `app.globalData.isDevBuild === true`
- 确认 `dataBackend === 'cloud'`

### HTTP 模式假ID不生效
- 检查 server 是否正确读取 `x-openid` header
- 检查 `server/src/index.js` 中的 `getOpenid()` 函数
- 确认没有其他中间件覆盖 openid

### 数据混乱
- 清空云数据库或本地SQLite的pairs表
- 删除测试账号的旧数据
- 重新开始测试流程

## 相关文档

- [P0配对同步修复说明](./p0-pair-sync-fixes.md)
- [QA清单](./p0-pair-checklist.md) (如果存在)
- [HTTP服务器设计](../../server/README.md)
