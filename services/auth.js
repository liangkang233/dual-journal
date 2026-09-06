/**
 * 登录 / openid 服务
 */

/**
 * 调用 login 云函数获取 openid，并写入 App.globalData
 * @returns {Promise<string>} openid
 */
function login() {
  return wx.cloud
    .callFunction({ name: 'login' })
    .then((res) => {
      const openid = (res.result && res.result.openid) || ''
      if (!openid) {
        return Promise.reject(new Error('登录失败：未返回 openid'))
      }
      const app = getApp()
      if (app && app.globalData) {
        app.globalData.openid = openid
      }
      return openid
    })
}

/**
 * 获取当前 openid（优先 globalData，否则重新 login）
 * @returns {Promise<string>}
 */
function getOpenid() {
  const app = getApp()
  const cached = app && app.globalData && app.globalData.openid
  if (cached) return Promise.resolve(cached)
  return login()
}

module.exports = {
  login,
  getOpenid,
}
