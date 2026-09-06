/**
 * Cloud adapter: entries (cloud DB + storage)
 */

const MAX_IMAGES = 9

/**
 * 要求已有 pairId，否则拒绝
 * @returns {Promise<string>}
 */
function requirePairId() {
  const app = getApp()
  const pairId = app && app.globalData && app.globalData.pairId
  if (!pairId) {
    return Promise.reject(new Error('尚未配对，无法操作见闻'))
  }
  return Promise.resolve(pairId)
}

/**
 * 按创建时间倒序列出本 pair 见闻
 * @param {string} [pairId]
 * @returns {Promise<Array>}
 */
function listEntries(pairId) {
  const resolveId = pairId
    ? Promise.resolve(pairId)
    : requirePairId()

  return resolveId.then((id) => {
    if (!id) {
      return Promise.reject(new Error('尚未配对，无法操作见闻'))
    }
    const db = wx.cloud.database()
    return db
      .collection('entries')
      .where({ pairId: id })
      .orderBy('createdAt', 'desc')
      .get()
      .then((res) => res.data || [])
  })
}

/**
 * 上传单张临时图片到云存储
 * @param {string} pairId
 * @param {string} entryId
 * @param {string} tempFilePath
 * @param {number} index
 * @returns {Promise<string>} fileID
 */
function uploadImage(pairId, entryId, tempFilePath, index) {
  const cloudPath = `pairs/${pairId}/entries/${entryId}/${index}.jpg`
  return wx.cloud
    .uploadFile({
      cloudPath,
      filePath: tempFilePath,
    })
    .then((res) => {
      if (!res.fileID) {
        return Promise.reject(new Error('图片上传失败'))
      }
      return res.fileID
    })
}

/**
 * 新建见闻：先写库拿 _id，再上传最多 9 张图，回写 imageFileIds
 * @param {{ title: string, content: string, tempFilePaths?: string[] }} payload
 * @returns {Promise<object>} 完整 entry 文档
 */
function createEntry(payload) {
  const title = (payload && payload.title) || ''
  const content = (payload && payload.content) || ''
  const tempFilePaths = ((payload && payload.tempFilePaths) || []).slice(
    0,
    MAX_IMAGES
  )

  const app = getApp()
  const openid = (app && app.globalData && app.globalData.openid) || ''

  return requirePairId().then((pairId) => {
    if (!openid) {
      return Promise.reject(new Error('未登录，请稍后重试'))
    }

    const db = wx.cloud.database()
    const now = Date.now()
    const process = String((payload && payload.process) || '').trim()
    const contentTrim = String(content).trim() || process
    const doc = {
      pairId,
      authorOpenid: openid,
      title: String(title).trim(),
      content: contentTrim,
      timeAt: String((payload && payload.timeAt) || '').trim(),
      location: String((payload && payload.location) || '').trim(),
      people: String((payload && payload.people) || '').trim(),
      cause: String((payload && payload.cause) || '').trim(),
      process: process || contentTrim,
      result: String((payload && payload.result) || '').trim(),
      imageFileIds: [],
      createdAt: now,
      updatedAt: now,
    }

    return db
      .collection('entries')
      .add({ data: doc })
      .then((addRes) => {
        const entryId = addRes._id
        if (!entryId) {
          return Promise.reject(new Error('创建见闻失败'))
        }

        if (!tempFilePaths.length) {
          return Object.assign({ _id: entryId }, doc)
        }

        const uploads = tempFilePaths.map((path, i) =>
          uploadImage(pairId, entryId, path, i)
        )

        return Promise.all(uploads).then((imageFileIds) => {
          return db
            .collection('entries')
            .doc(entryId)
            .update({
              data: {
                imageFileIds,
                updatedAt: Date.now(),
              },
            })
            .then(() =>
              Object.assign({ _id: entryId }, doc, {
                imageFileIds,
                updatedAt: Date.now(),
              })
            )
        })
      })
  })
}

/**
 * 获取单条见闻
 * @param {string} id
 * @returns {Promise<object|null>}
 */
function getEntry(id) {
  if (!id) {
    return Promise.reject(new Error('缺少见闻 ID'))
  }
  return requirePairId().then(() => {
    const db = wx.cloud.database()
    return db
      .collection('entries')
      .doc(id)
      .get()
      .then((res) => res.data || null)
  })
}


function updateEntry(id, payload) {
  if (!id) return Promise.reject(new Error('缺少见闻 ID'))
  const process = String((payload && payload.process) || '').trim()
  let content = String((payload && payload.content) || '').trim()
  if (!content && process) content = process
  return requirePairId().then(() => {
    const db = wx.cloud.database()
    const data = {
      title: String((payload && payload.title) || '').trim(),
      content,
      timeAt: String((payload && payload.timeAt) || '').trim(),
      location: String((payload && payload.location) || '').trim(),
      people: String((payload && payload.people) || '').trim(),
      cause: String((payload && payload.cause) || '').trim(),
      process: process || content,
      result: String((payload && payload.result) || '').trim(),
      updatedAt: Date.now(),
    }
    if (payload && Array.isArray(payload.imageFileIds)) {
      data.imageFileIds = payload.imageFileIds.slice(0, MAX_IMAGES)
    }
    return db.collection('entries').doc(id).update({ data }).then(() =>
      Object.assign({ _id: id }, data)
    )
  })
}

function removeEntry(id) {
  if (!id) return Promise.reject(new Error('缺少见闻 ID'))
  return requirePairId().then(() => {
    const db = wx.cloud.database()
    return db.collection('entries').doc(id).remove().then(() => undefined)
  })
}

module.exports = {
  listEntries,
  createEntry,
  updateEntry,
  removeEntry,
  getEntry,
  MAX_IMAGES,
}
