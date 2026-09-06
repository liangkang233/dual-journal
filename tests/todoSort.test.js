const assert = require('assert')
const { sortTodos } = require('../utils/todoSort')

const sorted = sortTodos([
  { title: 'a', priority: 'low', status: 'open' },
  { title: 'b', priority: 'high', status: 'done' },
  { title: 'c', priority: 'high', status: 'open' },
])
assert.strictEqual(sorted[0].title, 'c')
assert.strictEqual(sorted[1].title, 'a')
assert.strictEqual(sorted[2].title, 'b')

// dueAt ascending among same status+priority
const byDue = sortTodos([
  { title: 'late', priority: 'medium', status: 'open', dueAt: 200 },
  { title: 'early', priority: 'medium', status: 'open', dueAt: 100 },
  { title: 'none', priority: 'medium', status: 'open' },
])
assert.strictEqual(byDue[0].title, 'early')
assert.strictEqual(byDue[1].title, 'late')
assert.strictEqual(byDue[2].title, 'none')

console.log('todoSort ok')
