/**
 * Client data-backend configuration.
 * Defaults stay safe for cloud. Optional ../config.local.js overrides (gitignored).
 */
const defaults = {
  /** @type {'cloud' | 'http'} */
  dataBackend: 'cloud',
  /** WeChat cloud environment ID (override in config.local.js if needed) */
  cloudEnvId: '',
  /** Base URL for self-hosted HTTP API (no trailing slash). Used when dataBackend === 'http'. */
  httpBaseUrl: '',
}

let local = {}
try {
  // Optional local overrides — not committed (see config.example.js)
  local = require('../config.local.js')
} catch (e) {
  // absent or unloadable is fine
}

module.exports = Object.assign({}, defaults, local)
