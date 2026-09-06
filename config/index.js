/**
 * Client data-backend configuration.
 * Flip dataBackend between 'cloud' and 'http' to switch adapters.
 */
module.exports = {
  /** @type {'cloud' | 'http'} */
  dataBackend: 'cloud',
  /** WeChat cloud environment ID */
  cloudEnvId: 'test1-d3gl4me5obe3f13ce',
  /** Base URL for self-hosted HTTP API (no trailing slash). Used when dataBackend === 'http'. */
  httpBaseUrl: '',
}
