/**
 * Cloud adapter: pair (cloud DB + functions)
 */

const { PRESET_IDS } = require('../../utils/background')

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

const INVITE_TTL_MS = 48 * 60 * 60 * 1000
const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

function generateInviteCode() {
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += CHARSET[Math.floor(Math.random() * CHARSET.length)]
  }
  return code
}

function cloudCallError(err, fallback) {
  const code = err && (err.errCode || err.code)
  const msg = (err && (err.message || err.errMsg)) || ''
  if (code === -601034) {
    return new Error('未开通云服务：请在开发者工具打开「云开发」并绑定环境 test1')
  }
  return new Error(msg || fallback || '云调用失败')
}

/**
 * 客户端生成 / 刷新邀请码（不依赖云函数，云库直写）
 * @returns {Promise<{ pairId, inviteCode, inviteExpireAt }>}
 */
function createInviteLocal() {
  return ensureSolo().then((pair) => {
    if (!pair || !pair._id) {
      return Promise.reject(new Error('无法创建个人空间，请确认已开通云开发'))
    }
    const members = pair.memberOpenids || []
    if (members.length >= 2) {
      return Promise.reject(new Error('配对已满员，无法再生成邀请码'))
    }
    const inviteCode = generateInviteCode()
    const inviteExpireAt = Date.now() + INVITE_TTL_MS
    const db = wx.cloud.database()
    return db
      .collection('pairs')
      .doc(pair._id)
      .update({
        data: {
          inviteCode: inviteCode,
          inviteExpireAt: inviteExpireAt,
          inviteActive: true,
          updatedAt: Date.now(),
        },
      })
      .then(() => {
        const app = getApp()
        if (app && app.globalData) {
          app.globalData.pairId = pair._id
          app.globalData.pair = Object.assign({}, pair, {
            inviteCode: inviteCode,
            inviteExpireAt: inviteExpireAt,
            inviteActive: true,
          })
        }
        return {
          pairId: pair._id,
          inviteCode: inviteCode,
          inviteExpireAt: inviteExpireAt,
        }
      })
  })
}

/**
 * 生成 / 刷新邀请码：优先云库直写；失败再试云函数
 * @returns {Promise<{ pairId, inviteCode, inviteExpireAt }>}
 */
function createInvite() {
  return createInviteLocal().catch((localErr) => {
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
      .catch((fnErr) => {
        throw cloudCallError(fnErr, localErr.message || '生成邀请码失败')
      })
  })
}

/**
 * 客户端接受邀请（查询 pairs 后更新成员）
 * @param {string} inviteCode
 * @returns {Promise<{ pairId: string }>}
 */
function acceptInviteLocal(inviteCode) {
  const app = getApp()
  const openid = app && app.globalData && app.globalData.openid
  if (!openid) {
    return Promise.reject(new Error('未登录'))
  }
  const db = wx.cloud.database()
  const now = Date.now()
  return db
    .collection('pairs')
    .where({
      inviteCode: inviteCode,
      inviteActive: true,
    })
    .limit(1)
    .get()
    .then((res) => {
      const pair = (res.data && res.data[0]) || null
      if (!pair) {
        return Promise.reject(new Error('邀请码无效或已失效'))
      }
      if (pair.inviteExpireAt && pair.inviteExpireAt < now) {
        return Promise.reject(new Error('邀请码已过期'))
      }
      const members = pair.memberOpenids || []
      if (members.indexOf(openid) >= 0) {
        if (app.globalData) {
          app.globalData.pairId = pair._id
          app.globalData.pair = pair
        }
        return { pairId: pair._id }
      }
      if (members.length >= 2) {
        return Promise.reject(new Error('配对已满员'))
      }
      const nextMembers = members.concat([openid])
      return db
        .collection('pairs')
        .doc(pair._id)
        .update({
          data: {
            memberOpenids: nextMembers,
            inviteActive: nextMembers.length >= 2 ? false : true,
            updatedAt: now,
          },
        })
        .then(() => {
          if (app.globalData) {
            app.globalData.pairId = pair._id
            app.globalData.pair = Object.assign({}, pair, {
              memberOpenids: nextMembers,
              inviteActive: nextMembers.length < 2,
            })
          }
          return { pairId: pair._id }
        })
    })
}

/**
 * 接受邀请码加入配对：优先云库直写；失败再试云函数
 * @param {string} code
 * @returns {Promise<{ pairId: string }>}
 */
function acceptInvite(code) {
  const inviteCode = String(code || '')
    .trim()
    .toUpperCase()
  return acceptInviteLocal(inviteCode).catch((localErr) => {
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
      .catch((fnErr) => {
        throw cloudCallError(fnErr, localErr.message || '加入配对失败')
      })
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

/**
 * 云端单人空间：无 pair 时自动建一条仅含自己的 pairs 记录，便于未配对即可读写
 * @returns {Promise<object|null>}
 */
function ensureSolo() {
  return getMyPair().then((pair) => {
    if (pair) return pair
    const app = getApp()
    const openid = app && app.globalData && app.globalData.openid
    if (!openid) {
      return Promise.reject(new Error('未登录，无法创建个人空间'))
    }
    const db = wx.cloud.database()
    const now = Date.now()
    return db
      .collection('pairs')
      .add({
        data: {
          memberOpenids: [openid],
          inviteCode: '',
          inviteExpireAt: 0,
          inviteActive: false,
          background: { type: 'preset', presetId: 'blush' },
          createdAt: now,
          updatedAt: now,
        },
      })
      .then(() => getMyPair())
  })
}

module.exports = {
  getMyPair,
  createInvite,
  acceptInvite,
  ensureSolo,
  updateBackground,
}
