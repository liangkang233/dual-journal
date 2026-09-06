/**
 * Client config. Prefer editing config.local.js for secrets/overrides (gitignored, pack-ignored).
 * WeChat cannot dynamically require; keep this file simple.
 */
var defaults = {
  dataBackend: 'http',
  cloudEnvId: 'test1-d3gl4me5obe3f13ce',
  httpBaseUrl: 'http://127.0.0.1:8787',
}

var local = {}
try {
  local = require('../config.local.js')
} catch (e) {
  local = {}
}

module.exports = Object.assign({}, defaults, local)
