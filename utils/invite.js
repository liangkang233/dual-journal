const CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // 去掉 0O1IL 易混字符
const CODE_RE = /^[A-Z0-9]{6}$/

function generateInviteCode() {
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += CHARSET[Math.floor(Math.random() * CHARSET.length)]
  }
  return code
}

function isInviteCodeFormat(code) {
  return typeof code === 'string' && CODE_RE.test(String(code).trim().toUpperCase())
}

module.exports = { generateInviteCode, isInviteCodeFormat, CHARSET }
