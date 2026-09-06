/**
 * HTTP adapter: anniversaries
 */
const { isAnniversaryToday } = require('../../utils/anniversary')
const { request } = require('./request')

function requirePairId(pairId) {
  if (pairId) return Promise.resolve(pairId)
  const app = getApp()
  const id = app && app.globalData && app.globalData.pairId
  if (!id) {
    return Promise.reject(new Error('尚未配对，无法操作纪念日'))
  }
  return Promise.resolve(id)
}

function getTodaysAnniversaries(list, now) {
  const nowDate = now || new Date()
  return (list || []).filter((ann) => isAnniversaryToday(ann, nowDate))
}

function listAnniversaries(pairId) {
  return requirePairId(pairId).then((id) =>
    request(
      'GET',
      '/api/anniversaries?pairId=' + encodeURIComponent(id)
    ).then((data) => {
      const list = Array.isArray(data) ? data : (data && data.items) || []
      return list.sort((a, b) => {
        const da = String(a.date || '')
        const dbStr = String(b.date || '')
        return da.localeCompare(dbStr)
      })
    })
  )
}

function getAnniversary(id) {
  if (!id) {
    return Promise.reject(new Error('缺少纪念日 ID'))
  }
  return requirePairId().then(() =>
    request('GET', '/api/anniversaries/' + encodeURIComponent(id))
  )
}

function upsertAnniversary(payload) {
  const title = String((payload && payload.title) || '').trim()
  if (!title) {
    return Promise.reject(new Error('请填写纪念日标题'))
  }

  const date = String((payload && payload.date) || '').trim()
  if (!date) {
    return Promise.reject(new Error('请选择日期'))
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) && !/^\d{1,2}-\d{1,2}$/.test(date)) {
    return Promise.reject(new Error('日期格式无效'))
  }

  const repeatYearly = !!(payload && payload.repeatYearly)

  return requirePairId().then((pairId) => {
    const body = {
      pairId,
      title,
      date,
      repeatYearly,
      location: String((payload && payload.location) || '').trim(),
      people: String((payload && payload.people) || '').trim(),
      cause: String((payload && payload.cause) || '').trim(),
      process: String((payload && payload.process) || '').trim(),
      result: String((payload && payload.result) || '').trim(),
    }
    if (payload && payload._id) {
      body._id = payload._id
      return request(
        'PUT',
        '/api/anniversaries/' + encodeURIComponent(payload._id),
        body
      )
    }
    return request('POST', '/api/anniversaries', body)
  })
}

function removeAnniversary(id) {
  if (!id) {
    return Promise.reject(new Error('缺少纪念日 ID'))
  }
  return requirePairId().then(() =>
    request('DELETE', '/api/anniversaries/' + encodeURIComponent(id)).then(
      () => undefined
    )
  )
}

module.exports = {
  listAnniversaries,
  getAnniversary,
  upsertAnniversary,
  removeAnniversary,
  getTodaysAnniversaries,
  requirePairId,
}
