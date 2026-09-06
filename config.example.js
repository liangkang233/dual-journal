/**
 * Copy to config.local.js (gitignored) and adjust for local HTTP backend.
 * config/index.js merges this over safe defaults.
 */
module.exports = {
  /** @type {'cloud' | 'http'} */
  dataBackend: 'http',
  httpBaseUrl: 'http://127.0.0.1:8787',
  /** Optional cloud env id when testing cloud path */
  cloudEnvId: 'your-cloud-env-id',
}
