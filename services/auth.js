/**
 * auth facade — static require (WeChat miniprogram forbids dynamic require)
 */
const config = require('../config/index')
const cloud = require('../adapters/cloud/auth')
const http = require('../adapters/http/auth')

module.exports = config.dataBackend === 'http' ? http : cloud
