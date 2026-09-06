const CLOUD_ENV_ID = 'CLOUD_ENV_ID' // 开通云开发后替换为真实环境 ID

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
    this.loginPlaceholder()
  },

  /** 登录占位：后续 Task 3 接 login 云函数 */
  loginPlaceholder() {
    // TODO(Task 3): wx.cloud.callFunction({ name: 'login' })
    console.log('[app] cloud inited, login placeholder (env=%s)', CLOUD_ENV_ID)
  },
})
