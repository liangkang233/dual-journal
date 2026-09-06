/**
 * HTTP adapter: todos
 */
const { request } = require('./request')

const VALID_PRIORITIES = ['high', 'medium', 'low']
const VALID_STATUSES = ['open', 'done']

function requirePairId(pairId) {
  if (pairId) return Promise.resolve(pairId)
  const app = getApp()
  const id = app && app.globalData && app.globalData.pairId
  if (!id) {
    return Promise.reject(new Error('尚未配对，无法操作待办'))
  }
  return Promise.resolve(id)
}

function listTodos(pairId) {
  return requirePairId(pairId).then((id) =>
    request('GET', '/api/todos?pairId=' + encodeURIComponent(id)).then(
      (data) => (Array.isArray(data) ? data : (data && data.items) || [])
    )
  )
}

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

  return requirePairId().then((pairId) => {
    const body = {
      pairId,
      title,
      priority,
      dueAt: dueAt && !Number.isNaN(dueAt) ? dueAt : null,
    }
    if (payload && payload.status && VALID_STATUSES.indexOf(payload.status) >= 0) {
      body.status = payload.status
    }
    if (payload && payload._id) {
      body._id = payload._id
      return request('PUT', '/api/todos/' + encodeURIComponent(payload._id), body)
    }
    return request('POST', '/api/todos', body)
  })
}

function setTodoStatus(id, status) {
  if (!id) {
    return Promise.reject(new Error('缺少待办 ID'))
  }
  if (VALID_STATUSES.indexOf(status) < 0) {
    return Promise.reject(new Error('无效的状态'))
  }
  return requirePairId().then(() =>
    request('PATCH', '/api/todos/' + encodeURIComponent(id) + '/status', {
      status,
    }).then(() => undefined)
  )
}

function removeTodo(id) {
  if (!id) {
    return Promise.reject(new Error('缺少待办 ID'))
  }
  return requirePairId().then(() =>
    request('DELETE', '/api/todos/' + encodeURIComponent(id)).then(
      () => undefined
    )
  )
}

function getTodo(id) {
  if (!id) {
    return Promise.reject(new Error('缺少待办 ID'))
  }
  return requirePairId().then(() =>
    request('GET', '/api/todos/' + encodeURIComponent(id))
  )
}

module.exports = {
  listTodos,
  upsertTodo,
  setTodoStatus,
  removeTodo,
  getTodo,
}
