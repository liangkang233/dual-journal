const config = require('../config/index')
const cloud = require('../adapters/cloud/entries')
const http = require('../adapters/http/entries')
module.exports = config.dataBackend === 'http' ? http : cloud
