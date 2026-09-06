/**
 * anniversaries facade — static require (WeChat miniprogram forbids dynamic require)
 */
const config = require('../config/index')
const cloud = require('../adapters/cloud/anniversaries')
const http = require('../adapters/http/anniversaries')

module.exports = config.dataBackend === 'http' ? http : cloud
