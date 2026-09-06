/**
 * HTTP adapter: pair
 */
const { PRESET_IDS } = require('../../utils/background')
const { request, upload } = require('./request')

function getMyPair() {
  const app = getApp()
  const openid = app && app.globalData && app.globalData.openid
  if (!openid) {
    return Promise.resolve(null)
  }

  return request('GET', '/api/pairs/me').then((pair) => {
    const resolved = pair || null
    if (app && app.globalData) {
      if (resolved) {
        app.globalData.pairId = resolved._id
        app.globalData.pair = resolved
      } else {
        app.globalData.pairId = ''
        app.globalData.pair = null
      }
    }
    return resolved
  })
}

function createInvite() {
  return request('POST', '/api/pairs/invite').then((result) => {
    if (!result || !result.pairId) {
      return Promise.reject(new Error((result && result.error) || '生成邀请码失败'))
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

function acceptInvite(code) {
  const inviteCode = String(code || '')
    .trim()
    .toUpperCase()
  return request('POST', '/api/pairs/accept', { inviteCode }).then((result) => {
    if (!result || !result.pairId) {
      return Promise.reject(new Error((result && result.error) || '加入配对失败'))
    }
    const app = getApp()
    if (app && app.globalData) {
      app.globalData.pairId = result.pairId
    }
    return { pairId: result.pairId }
  })
}

function requirePairId() {
  const app = getApp()
  const pairId = app && app.globalData && app.globalData.pairId
  if (!pairId) {
    return Promise.reject(new Error('尚未配对，无法更换背景'))
  }
  return Promise.resolve(pairId)
}

function updateBackground(opts) {
  const type = opts && opts.type
  if (type !== 'preset' && type !== 'custom') {
    return Promise.reject(new Error('背景类型无效'))
  }

  return requirePairId().then((pairId) => {
    if (type === 'preset') {
      const presetId =
        PRESET_IDS.indexOf(opts.presetId) >= 0 ? opts.presetId : ''
      if (!presetId) {
        return Promise.reject(new Error('请选择有效的预设主题'))
      }
      return request('PUT', '/api/pairs/' + pairId + '/background', {
        type: 'preset',
        presetId: presetId,
      }).then((background) => {
        const app = getApp()
        if (app && app.globalData) {
          const pair = app.globalData.pair || { _id: pairId }
          app.globalData.pair = Object.assign({}, pair, {
            background: background,
            updatedAt: Date.now(),
          })
        }
        return background
      })
    }

    if (opts.tempFilePath) {
      return upload(
        '/api/pairs/' + pairId + '/background',
        opts.tempFilePath,
        'file',
        { type: 'custom' }
      ).then((background) => {
        const app = getApp()
        if (app && app.globalData) {
          const pair = app.globalData.pair || { _id: pairId }
          app.globalData.pair = Object.assign({}, pair, {
            background: background,
            updatedAt: Date.now(),
          })
        }
        return background
      })
    }

    if (opts.fileId) {
      return request('PUT', '/api/pairs/' + pairId + '/background', {
        type: 'custom',
        fileId: opts.fileId,
      }).then((background) => {
        const app = getApp()
        if (app && app.globalData) {
          const pair = app.globalData.pair || { _id: pairId }
          app.globalData.pair = Object.assign({}, pair, {
            background: background,
            updatedAt: Date.now(),
          })
        }
        return background
      })
    }

    return Promise.reject(new Error('请选择自定义背景图'))
  })
}


function ensureSolo() {
  return request('POST', '/api/pairs/ensure-solo').then((pair) => {
    if (!pair || !pair._id) {
      return Promise.reject(new Error((pair && pair.error) || '创建个人空间失败'))
    }
    const app = getApp()
    if (app && app.globalData) {
      app.globalData.pairId = pair._id
      app.globalData.pair = pair
    }
    return pair
  })
}

module.exports = {
  getMyPair,
  createInvite,
  acceptInvite,
  ensureSolo,
  updateBackground,
}
