const RANK = { high: 0, medium: 1, low: 2 }

function sortTodos(todos) {
  return [...todos].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'open' ? -1 : 1
    if (RANK[a.priority] !== RANK[b.priority]) return RANK[a.priority] - RANK[b.priority]
    const da = a.dueAt || Number.MAX_SAFE_INTEGER
    const db = b.dueAt || Number.MAX_SAFE_INTEGER
    return da - db
  })
}

module.exports = { sortTodos }
