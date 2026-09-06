/**
 * Minimal wx.request / wx.uploadFile helpers for the HTTP adapter.
 */
const config = require('../../config/index')

function getBaseUrl() {
  const base = (config.httpBaseUrl || '').replace(/\/$/, '')
  if (!base) {
    return Promise.reject(
      new Error('httpBaseUrl 未配置：请在 config/index.js 填写自建 API 地址')
    )
  }
  return Promise.resolve(base)
}

/**
 * @param {string} method
 * @param {string} path - starts with /
 * @param {object} [data]
 * @returns {Promise<any>}
 */
function request(method, path, data) {
  return getBaseUrl().then(
    (base) =>
      new Promise((resolve, reject) => {
        const app = getApp()
        const openid =
          (app && app.globalData && app.globalData.openid) || ''
        wx.request({
          url: base + path,
          method: method,
          data: data || {},
          header: {
            'content-type': 'application/json',
            'x-openid': openid,
          },
          success(res) {
            const status = res.statusCode || 0
            if (status < 200 || status >= 300) {
              const msg =
                (res.data && (res.data.error || res.data.message)) ||
                'HTTP ' + status
              reject(new Error(msg))
              return
            }
            resolve(res.data)
          },
          fail(err) {
            reject(err || new Error('网络请求失败'))
          },
        })
      })
  )
}

/**
 * Multipart upload via wx.uploadFile.
 * @param {string} path
 * @param {string} filePath
 * @param {string} [name]
 * @param {object} [formData]
 * @returns {Promise<any>}
 */
function upload(path, filePath, name, formData) {
  return getBaseUrl().then(
    (base) =>
      new Promise((resolve, reject) => {
        const app = getApp()
        const openid =
          (app && app.globalData && app.globalData.openid) || ''
        wx.uploadFile({
          url: base + path,
          filePath: filePath,
          name: name || 'file',
          formData: formData || {},
          header: {
            'x-openid': openid,
          },
          success(res) {
            const status = res.statusCode || 0
            let body = res.data
            if (typeof body === 'string') {
              try {
                body = JSON.parse(body)
              } catch (e) {
                /* keep string */
              }
            }
            if (status < 200 || status >= 300) {
              const msg =
                (body && (body.error || body.message)) || 'HTTP ' + status
              reject(new Error(msg))
              return
            }
            resolve(body)
          },
          fail(err) {
            reject(err || new Error('上传失败'))
          },
        })
      })
  )
}

module.exports = {
  request,
  upload,
  getBaseUrl,
}
