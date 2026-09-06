/**
 * 配对相关云函数封装
 */

const { PRESET_IDS } = require('../utils/background')

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

/**
 * 要求已有 pairId
 * @returns {Promise<string>}
 */
function requirePairId() {
  const app = getApp()
  const pairId = app && app.globalData && app.globalData.pairId
  if (!pairId) {
    return Promise.reject(new Error('尚未配对，无法更换背景'))
  }
  return Promise.resolve(pairId)
}

/**
 * 上传自定义背景图到云存储
 * @param {string} pairId
 * @param {string} tempFilePath
 * @returns {Promise<string>} fileID
 */
function uploadBackgroundImage(pairId, tempFilePath) {
  const cloudPath = 'pairs/' + pairId + '/background.jpg'
  return wx.cloud
    .uploadFile({
      cloudPath: cloudPath,
      filePath: tempFilePath,
    })
    .then((res) => {
      if (!res.fileID) {
        return Promise.reject(new Error('背景图上传失败'))
      }
      return res.fileID
    })
}

/**
 * 更新 pair 背景主题
 * @param {{ type: 'preset'|'custom', presetId?: string, fileId?: string, tempFilePath?: string }} opts
 * @returns {Promise<{ type: string, presetId?: string, fileId?: string }>}
 */
function updateBackground(opts) {
  const type = opts && opts.type
  if (type !== 'preset' && type !== 'custom') {
    return Promise.reject(new Error('背景类型无效'))
  }

  return requirePairId().then((pairId) => {
    let prepare
    if (type === 'preset') {
      const presetId =
        PRESET_IDS.indexOf(opts.presetId) >= 0 ? opts.presetId : ''
      if (!presetId) {
        return Promise.reject(new Error('请选择有效的预设主题'))
      }
      prepare = Promise.resolve({
        type: 'preset',
        presetId: presetId,
      })
    } else if (opts.tempFilePath) {
      prepare = uploadBackgroundImage(pairId, opts.tempFilePath).then(
        (fileId) => ({
          type: 'custom',
          fileId: fileId,
        })
      )
    } else if (opts.fileId) {
      prepare = Promise.resolve({
        type: 'custom',
        fileId: opts.fileId,
      })
    } else {
      return Promise.reject(new Error('请选择自定义背景图'))
    }

    return prepare.then((background) => {
      const db = wx.cloud.database()
      const now = Date.now()
      return db
        .collection('pairs')
        .doc(pairId)
        .update({
          data: {
            background: background,
            updatedAt: now,
          },
        })
        .then(() => {
          const app = getApp()
          if (app && app.globalData) {
            const pair = app.globalData.pair || { _id: pairId }
            app.globalData.pair = Object.assign({}, pair, {
              background: background,
              updatedAt: now,
            })
          }
          return background
        })
    })
  })
}

module.exports = {
  getMyPair,
  createInvite,
  acceptInvite,
  updateBackground,
}
