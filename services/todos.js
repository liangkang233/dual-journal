const config = require('../config/index')
const cloud = require('../adapters/cloud/todos')
const http = require('../adapters/http/todos')
module.exports = config.dataBackend === 'http' ? http : cloud
