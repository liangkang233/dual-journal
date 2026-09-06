const assert = require('assert')
const { generateInviteCode, isInviteCodeFormat } = require('../utils/invite')

const code = generateInviteCode()
assert.strictEqual(typeof code, 'string')
assert.strictEqual(code.length, 6)
assert.match(code, /^[A-Z0-9]{6}$/)
assert.strictEqual(isInviteCodeFormat(code), true)

assert.strictEqual(isInviteCodeFormat('ABC123'), true)
assert.strictEqual(isInviteCodeFormat('abc123'), false)
assert.strictEqual(isInviteCodeFormat('AB12'), false)
assert.strictEqual(isInviteCodeFormat('ABCDEFG'), false)
assert.strictEqual(isInviteCodeFormat('ABC12!'), false)
assert.strictEqual(isInviteCodeFormat(''), false)
assert.strictEqual(isInviteCodeFormat(null), false)

console.log('invite ok')
