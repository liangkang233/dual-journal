/**
 * HTTP adapter: login / openid
 */
const { request } = require('./request')

function login() {
  return request('POST', '/api/auth/login').then((data) => {
    const openid = (data && data.openid) || ''
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
