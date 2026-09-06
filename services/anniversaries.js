/**
 * Anniversaries facade — delegates to cloud or http adapter via config.dataBackend
 */
module.exports = require('../adapters').loadAdapter('anniversaries')
