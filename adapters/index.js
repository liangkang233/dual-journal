/**
 * Prefer requiring adapters via services/*.js (static).
 * Kept for compatibility — still static branches only.
 */
const config = require('../config/index')

function loadAdapter(name) {
  if (name === 'auth') {
    return config.dataBackend === 'http'
      ? require('./http/auth')
      : require('./cloud/auth')
  }
  if (name === 'pair') {
    return config.dataBackend === 'http'
      ? require('./http/pair')
      : require('./cloud/pair')
  }
  if (name === 'entries') {
    return config.dataBackend === 'http'
      ? require('./http/entries')
      : require('./cloud/entries')
  }
  if (name === 'todos') {
    return config.dataBackend === 'http'
      ? require('./http/todos')
      : require('./cloud/todos')
  }
  if (name === 'anniversaries') {
    return config.dataBackend === 'http'
      ? require('./http/anniversaries')
      : require('./cloud/anniversaries')
  }
  throw new Error('unknown adapter: ' + name)
}

module.exports = { loadAdapter }
