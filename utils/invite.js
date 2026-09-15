const CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/

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
