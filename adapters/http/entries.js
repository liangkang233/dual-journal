/**
 * HTTP adapter: entries
 */
const { request, upload } = require('./request')

const MAX_IMAGES = 9

function requirePairId() {
  const app = getApp()
  const pairId = app && app.globalData && app.globalData.pairId
  if (!pairId) {
    return Promise.reject(new Error('尚未配对，无法操作见闻'))
  }
  return Promise.resolve(pairId)
}

function listEntries(pairId) {
  const resolveId = pairId ? Promise.resolve(pairId) : requirePairId()
  return resolveId.then((id) => {
    if (!id) {
      return Promise.reject(new Error('尚未配对，无法操作见闻'))
    }
    return request('GET', '/api/entries?pairId=' + encodeURIComponent(id)).then(
      (data) => (Array.isArray(data) ? data : (data && data.items) || [])
    )
  })
}

function createEntry(payload) {
  const title = (payload && payload.title) || ''
  const content = (payload && payload.content) || ''
  const tempFilePaths = ((payload && payload.tempFilePaths) || []).slice(
    0,
    MAX_IMAGES
  )

  return requirePairId().then((pairId) => {
    return request('POST', '/api/entries', {
      pairId,
      title: String(title).trim(),
      content: String(content).trim(),
    }).then((entry) => {
      if (!entry || !entry._id) {
        return Promise.reject(new Error('创建见闻失败'))
      }
      if (!tempFilePaths.length) {
        return entry
      }

      const uploads = tempFilePaths.map((path, i) =>
        upload(
          '/api/entries/' + entry._id + '/images',
          path,
          'file',
          { index: String(i), pairId }
        ).then((res) => (res && (res.fileId || res.fileID)) || res)
      )

      return Promise.all(uploads).then((imageFileIds) =>
        request('PATCH', '/api/entries/' + entry._id, { imageFileIds }).then(
          (updated) =>
            Object.assign({}, entry, updated || {}, { imageFileIds })
        )
      )
    })
  })
}

function getEntry(id) {
  if (!id) {
    return Promise.reject(new Error('缺少见闻 ID'))
  }
  return requirePairId().then(() =>
    request('GET', '/api/entries/' + encodeURIComponent(id))
  )
}

module.exports = {
  listEntries,
  createEntry,
  getEntry,
  MAX_IMAGES,
}
