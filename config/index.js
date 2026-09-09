var defaults = {
  dataBackend: 'cloud',
  cloudEnvId: 'cloud1-d1gbvd1vw92534fc6',
  httpBaseUrl: 'http://127.0.0.1:8787',
}
var local = {}
try { local = require('../config.local.js') } catch (e) { local = {} }
module.exports = Object.assign({}, defaults, local)
