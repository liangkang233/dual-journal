const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const CODE_RE = /^[A-Z0-9]{6}$/

function generateInviteCode() {
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += CHARSET[Math.floor(Math.random() * CHARSET.length)]
  }
  return code
}

function isInviteCodeFormat(code) {
  return typeof code === 'string' && CODE_RE.test(code)
}

module.exports = { generateInviteCode, isInviteCodeFormat }
