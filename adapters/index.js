/**
 * Resolve data adapter by config.dataBackend ('cloud' | 'http').
 * @param {string} name - module name without path, e.g. 'auth'
 * @returns {object}
 */
function loadAdapter(name) {
  const config = require('../config/index')
  const backend = config.dataBackend === 'http' ? 'http' : 'cloud'
  return require('./' + backend + '/' + name)
}

module.exports = {
  loadAdapter,
}
