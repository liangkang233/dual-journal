const config = require('../config/index')
const cloud = require('../adapters/cloud/pair')
const http = require('../adapters/http/pair')
module.exports = config.dataBackend === 'http' ? http : cloud
