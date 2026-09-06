/**
 * 配对相关云函数封装
 */

/**
 * 查询当前用户所在的 pair（云数据库 pairs，memberOpenids 含 openid）
 * @returns {Promise<object|null>}
 */
function getMyPair() {
  const app = getApp()
  const openid = app && app.globalData && app.globalData.openid
  if (!openid) {
    return Promise.resolve(null)
  }

  const db = wx.cloud.database()
  return db
    .collection('pairs')
    .where({ memberOpenids: openid })
    .limit(1)
    .get()
    .then((res) => {
      const pair = (res.data && res.data[0]) || null
      if (app && app.globalData) {
        if (pair) {
          app.globalData.pairId = pair._id
          app.globalData.pair = pair
        } else {
          app.globalData.pairId = ''
          app.globalData.pair = null
        }
      }
      return pair
    })
}

/**
 * 生成 / 刷新邀请码
 * @returns {Promise<{ pairId, inviteCode, inviteExpireAt }>}
 */
function createInvite() {
  return wx.cloud
    .callFunction({ name: 'createInvite' })
    .then((res) => {
      const result = res.result || {}
      if (!result.ok) {
        return Promise.reject(new Error(result.error || '生成邀请码失败'))
      }
      const app = getApp()
      if (app && app.globalData) {
        app.globalData.pairId = result.pairId
      }
      return {
        pairId: result.pairId,
        inviteCode: result.inviteCode,
        inviteExpireAt: result.inviteExpireAt,
      }
    })
}

/**
 * 接受邀请码加入配对
 * @param {string} code
 * @returns {Promise<{ pairId: string }>}
 */
function acceptInvite(code) {
  const inviteCode = String(code || '')
    .trim()
    .toUpperCase()
  return wx.cloud
    .callFunction({
      name: 'acceptInvite',
      data: { inviteCode },
    })
    .then((res) => {
      const result = res.result || {}
      if (!result.ok) {
        return Promise.reject(new Error(result.error || '加入配对失败'))
      }
      const app = getApp()
      if (app && app.globalData) {
        app.globalData.pairId = result.pairId
      }
      return { pairId: result.pairId }
    })
}

module.exports = {
  getMyPair,
  createInvite,
  acceptInvite,
}
