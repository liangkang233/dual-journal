/**
 * HTTP adapter: login / openid
 * Persists openid in storage so local http sessions stay stable.
 */
const { request } = require('./request')

const STORAGE_KEY = 'http_local_openid'

function readCachedOpenid() {
  try {
    return String(wx.getStorageSync(STORAGE_KEY) || '').trim()
  } catch (e) {
    return ''
  }
}

function writeCachedOpenid(openid) {
  try {
    wx.setStorageSync(STORAGE_KEY, openid)
  } catch (e) {
    // ignore
  }
}

function login() {
  const cached = readCachedOpenid()
  const app = getApp()
  if (cached && app && app.globalData) {
    app.globalData.openid = cached
  }

  const body = cached ? { openid: cached } : {}
  return request('POST', '/api/auth/login', body).then((data) => {
    const openid = (data && data.openid) || ''
    if (!openid) {
      return Promise.reject(new Error('登录失败：未返回 openid'))
    }
    writeCachedOpenid(openid)
    if (app && app.globalData) {
      app.globalData.openid = openid
    }
    return openid
  })
}

function getOpenid() {
  const app = getApp()
  const cached = (app && app.globalData && app.globalData.openid) || readCachedOpenid()
  if (cached) {
    if (app && app.globalData) app.globalData.openid = cached
    return Promise.resolve(cached)
  }
  return login()
}

module.exports = {
  login,
  getOpenid,
}
