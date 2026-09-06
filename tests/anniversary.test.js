const assert = require('assert')
const { isAnniversaryToday } = require('../utils/anniversary')

// yearly: match month-day only
assert.strictEqual(
  isAnniversaryToday(
    { date: '2020-03-15', repeatYearly: true },
    new Date(2026, 2, 15)
  ),
  true
)
assert.strictEqual(
  isAnniversaryToday(
    { date: '2020-03-15', repeatYearly: true },
    new Date(2026, 2, 16)
  ),
  false
)

// non-yearly: full year-month-day
assert.strictEqual(
  isAnniversaryToday(
    { date: '2026-09-06', repeatYearly: false },
    new Date(2026, 8, 6)
  ),
  true
)
assert.strictEqual(
  isAnniversaryToday(
    { date: '2025-09-06', repeatYearly: false },
    new Date(2026, 8, 6)
  ),
  false
)

// default nowDate
const realNow = new Date()
const y = realNow.getFullYear()
const m = String(realNow.getMonth() + 1).padStart(2, '0')
const d = String(realNow.getDate()).padStart(2, '0')
assert.strictEqual(
  isAnniversaryToday({ date: `${y}-${m}-${d}`, repeatYearly: false }),
  true
)

console.log('anniversary ok')
