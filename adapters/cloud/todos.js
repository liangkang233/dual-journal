/**
 * Cloud adapter: todos (cloud DB)
 * 字段见 spec §5.3：priority high|medium|low，status open|done
 */

const VALID_PRIORITIES = ['high', 'medium', 'low']
const VALID_STATUSES = ['open', 'done']

/**
 * 要求已有 pairId，否则拒绝
 * @returns {Promise<string>}
 */
function requirePairId(pairId) {
  if (pairId) return Promise.resolve(pairId)
  const app = getApp()
  const id = app && app.globalData && app.globalData.pairId
  if (!id) {
    return Promise.reject(new Error('尚未配对，无法操作待办'))
  }
  return Promise.resolve(id)
}

/**
 * 列出本 pair 待办（未排序；页面侧用 sortTodos）
 * @param {string} [pairId]
 * @returns {Promise<Array>}
 */
function listTodos(pairId) {
  return requirePairId(pairId).then((id) => {
    const db = wx.cloud.database()
    return db
      .collection('todos')
      .where({ pairId: id })
      .get()
      .then((res) => res.data || [])
  })
}

/**
 * 新建或更新待办
 * @param {{ _id?: string, title: string, priority?: string, dueAt?: number|null, status?: string }} payload
 * @returns {Promise<object>}
 */
function upsertTodo(payload) {
  const title = String((payload && payload.title) || '').trim()
  if (!title) {
    return Promise.reject(new Error('请填写待办标题'))
  }

  let priority = (payload && payload.priority) || 'medium'
  if (VALID_PRIORITIES.indexOf(priority) < 0) {
    priority = 'medium'
  }

  const dueAt =
    payload && payload.dueAt != null && payload.dueAt !== ''
      ? Number(payload.dueAt)
      : null

  const app = getApp()
  const openid = (app && app.globalData && app.globalData.openid) || ''

  return requirePairId().then((pairId) => {
    if (!openid) {
      return Promise.reject(new Error('未登录，请稍后重试'))
    }

    const db = wx.cloud.database()
    const now = Date.now()
    const existingId = payload && payload._id

    if (existingId) {
      const updateData = {
        title,
        priority,
        dueAt: dueAt && !Number.isNaN(dueAt) ? dueAt : null,
        updatedByOpenid: openid,
        updatedAt: now,
      }
      if (payload.status && VALID_STATUSES.indexOf(payload.status) >= 0) {
        updateData.status = payload.status
      }
      return db
        .collection('todos')
        .doc(existingId)
        .update({ data: updateData })
        .then(() => Object.assign({ _id: existingId, pairId }, updateData))
    }

    const doc = {
      pairId,
      title,
      priority,
      status: 'open',
      dueAt: dueAt && !Number.isNaN(dueAt) ? dueAt : null,
      creatorOpenid: openid,
      updatedByOpenid: openid,
      createdAt: now,
      updatedAt: now,
    }

    return db
      .collection('todos')
      .add({ data: doc })
      .then((addRes) => {
        if (!addRes._id) {
          return Promise.reject(new Error('创建待办失败'))
        }
        return Object.assign({ _id: addRes._id }, doc)
      })
  })
}

/**
 * 设置完成状态
 * @param {string} id
 * @param {'open'|'done'} status
 * @returns {Promise<void>}
 */
function setTodoStatus(id, status) {
  if (!id) {
    return Promise.reject(new Error('缺少待办 ID'))
  }
  if (VALID_STATUSES.indexOf(status) < 0) {
    return Promise.reject(new Error('无效的状态'))
  }

  const app = getApp()
  const openid = (app && app.globalData && app.globalData.openid) || ''

  return requirePairId().then(() => {
    const db = wx.cloud.database()
    return db
      .collection('todos')
      .doc(id)
      .update({
        data: {
          status,
          updatedByOpenid: openid,
          updatedAt: Date.now(),
        },
      })
      .then(() => undefined)
  })
}

/**
 * 删除待办
 * @param {string} id
 * @returns {Promise<void>}
 */
function removeTodo(id) {
  if (!id) {
    return Promise.reject(new Error('缺少待办 ID'))
  }
  return requirePairId().then(() => {
    const db = wx.cloud.database()
    return db
      .collection('todos')
      .doc(id)
      .remove()
      .then(() => undefined)
  })
}

/**
 * 获取单条待办
 * @param {string} id
 * @returns {Promise<object|null>}
 */
function getTodo(id) {
  if (!id) {
    return Promise.reject(new Error('缺少待办 ID'))
  }
  return requirePairId().then(() => {
    const db = wx.cloud.database()
    return db
      .collection('todos')
      .doc(id)
      .get()
      .then((res) => res.data || null)
  })
}

module.exports = {
  listTodos,
  upsertTodo,
  setTodoStatus,
  removeTodo,
  getTodo,
}
