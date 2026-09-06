const CLOUD_ENV_ID = 'CLOUD_ENV_ID' // 开通云开发后替换为真实环境 ID
const auth = require('./services/auth')
const pairService = require('./services/pair')

App({
  globalData: {
    openid: '',
    pairId: '',
    pair: null,
  },

  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
      return
    }
    wx.cloud.init({
      env: CLOUD_ENV_ID,
      traceUser: true,
    })
    this.ensureLogin()
  },

  /** 登录并尝试拉取已有配对 */
  ensureLogin() {
    return auth
      .login()
      .then(() => pairService.getMyPair())
      .catch((err) => {
        console.error('[app] login/pair init failed', err)
      })
  },
})
