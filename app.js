App({
  globalData: {
    openid: '',
    pairId: '',
    pair: null,
    dataBackend: 'http',
  },
  onLaunch() {
    console.log('[app] minimal launch ok')
  },
  ensureLogin() {
    return Promise.resolve(null)
  },
})
