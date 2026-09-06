/**
 * Cloud adapter: anniversaries (cloud DB)
 * 字段见 spec §5.4：title, date, repeatYearly
 */

const { isAnniversaryToday } = require('../../utils/anniversary')

/**
 * 要求已有 pairId，否则拒绝
 * @param {string} [pairId]
 * @returns {Promise<string>}
 */
function requirePairId(pairId) {
  if (pairId) return Promise.resolve(pairId)
  const app = getApp()
  const id = app && app.globalData && app.globalData.pairId
  if (!id) {
    return Promise.reject(new Error('尚未配对，无法操作纪念日'))
  }
  return Promise.resolve(id)
}

/**
 * 从列表中筛出今日命中的纪念日
 * @param {Array} list
 * @param {Date} [now]
 * @returns {Array}
 */
function getTodaysAnniversaries(list, now) {
  const nowDate = now || new Date()
  return (list || []).filter((ann) => isAnniversaryToday(ann, nowDate))
}

/**
 * 列出本 pair 纪念日
 * @param {string} [pairId]
 * @returns {Promise<Array>}
 */
function listAnniversaries(pairId) {
  return requirePairId(pairId).then((id) => {
    const db = wx.cloud.database()
    return db
      .collection('anniversaries')
      .where({ pairId: id })
      .get()
      .then((res) => {
        const list = res.data || []
        return list.sort((a, b) => {
          const da = String(a.date || '')
          const dbStr = String(b.date || '')
          return da.localeCompare(dbStr)
        })
      })
  })
}

/**
 * 获取单条纪念日
 * @param {string} id
 * @returns {Promise<object|null>}
 */
function getAnniversary(id) {
  if (!id) {
    return Promise.reject(new Error('缺少纪念日 ID'))
  }
  return requirePairId().then(() => {
    const db = wx.cloud.database()
    return db
      .collection('anniversaries')
      .doc(id)
      .get()
      .then((res) => res.data || null)
  })
}

/**
 * 新建或更新纪念日
 * @param {{ _id?: string, title: string, date: string, repeatYearly?: boolean }} payload
 * @returns {Promise<object>}
 */
function upsertAnniversary(payload) {
  const title = String((payload && payload.title) || '').trim()
  if (!title) {
    return Promise.reject(new Error('请填写纪念日标题'))
  }

  const date = String((payload && payload.date) || '').trim()
  if (!date) {
    return Promise.reject(new Error('请选择日期'))
  }
  // 支持 YYYY-MM-DD 或 MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) && !/^\d{1,2}-\d{1,2}$/.test(date)) {
    return Promise.reject(new Error('日期格式无效'))
  }

  const repeatYearly = !!(payload && payload.repeatYearly)

  return requirePairId().then((pairId) => {
    const db = wx.cloud.database()
    const now = Date.now()
    const existingId = payload && payload._id

    if (existingId) {
      const updateData = {
        title,
        date,
        repeatYearly,
        updatedAt: now,
      }
      return db
        .collection('anniversaries')
        .doc(existingId)
        .update({ data: updateData })
        .then(() => Object.assign({ _id: existingId, pairId }, updateData))
    }

    const doc = {
      pairId,
      title,
      date,
      repeatYearly,
      createdAt: now,
      updatedAt: now,
    }

    return db
      .collection('anniversaries')
      .add({ data: doc })
      .then((addRes) => {
        if (!addRes._id) {
          return Promise.reject(new Error('创建纪念日失败'))
        }
        return Object.assign({ _id: addRes._id }, doc)
      })
  })
}

/**
 * 删除纪念日
 * @param {string} id
 * @returns {Promise<void>}
 */
function removeAnniversary(id) {
  if (!id) {
    return Promise.reject(new Error('缺少纪念日 ID'))
  }
  return requirePairId().then(() => {
    const db = wx.cloud.database()
    return db
      .collection('anniversaries')
      .doc(id)
      .remove()
      .then(() => undefined)
  })
}

module.exports = {
  listAnniversaries,
  getAnniversary,
  upsertAnniversary,
  removeAnniversary,
  getTodaysAnniversaries,
  requirePairId,
}
