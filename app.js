const config = require('./config/index')
const auth = require('./services/auth')
const pairService = require('./services/pair')

const CLOUD_ENV_ID = config.cloudEnvId

App({
  globalData: {
    openid: '',
    pairId: '',
    pair: null,
    dataBackend: config.dataBackend,
  },

  onLaunch() {
    if (config.dataBackend === 'cloud') {
      if (!wx.cloud) {
        console.error('请使用 2.2.3 或以上的基础库以使用云能力')
        return
      }
      wx.cloud.init({
        env: CLOUD_ENV_ID,
        traceUser: true,
      })
    } else if (!config.httpBaseUrl) {
      console.warn(
        '[app] dataBackend=http 但 httpBaseUrl 为空，请在 config/index.js 配置'
      )
    }
    this.ensureLogin()
  },

  /**
   * 登录并拉取配对；http 模式下若无 pair 则 ensure-solo 自动创建单人空间
   */
  ensureLogin() {
    return auth
      .login()
      .then(() => pairService.getMyPair())
      .then((pair) => {
        if (pair) return pair
        if (typeof pairService.ensureSolo === 'function') {
          return pairService.ensureSolo()
        }
        return null
      })
      .catch((err) => {
        console.error('[app] login/pair init failed', err)
        return null
      })
  },
})
