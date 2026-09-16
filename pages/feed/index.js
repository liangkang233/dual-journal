const app = getApp()
const entriesService = require('../../services/entries')
const annService = require('../../services/anniversaries')
const { applyPairBackground } = require('../../utils/background')
const { formatRelativeTime } = require('../../utils/relativeTime')

Page({
  data: {
    paired: false,
    loading: false,
    entries: [],
    todayAnns: [],
    todayBannerText: '',
    emptyTitle: '暂无见闻',
    emptyDesc: '登录后会自动创建个人空间；也可去「我们」邀请对方',
    bgClass: 'page-bg page-bg-warm',
    bgStyle: '',
    _lastPairId: '',
    _lastLoadedAt: 0,
    _lastPairEpoch: 0,
  },

  onShow() {
    applyPairBackground(this)
    const boot = app.ensureLogin ? app.ensureLogin() : Promise.resolve()
    boot.then(() => {
      const paired = !!(app.globalData && app.globalData.pairId)
      const pairId = (app.globalData && app.globalData.pairId) || ''
      const pairEpoch = (app.globalData && app.globalData.pairEpoch) || 0
      this.setData({ paired })
      if (!paired) {
        this.setData({ todayAnns: [], todayBannerText: '', entries: [], _lastPairId: '', _lastLoadedAt: 0, _lastPairEpoch: 0 })
        return
      }

      const now = Date.now()
      const lastPairId = this.data._lastPairId
      const lastLoadedAt = this.data._lastLoadedAt
      const lastPairEpoch = this.data._lastPairEpoch
      const hasData = this.data.entries && this.data.entries.length > 0
      const TTL = 20 * 1000
      const isFresh = pairId === lastPairId && (now - lastLoadedAt) < TTL
      const pairChanged = pairId !== lastPairId
      const epochChanged = pairEpoch !== lastPairEpoch

      if (pairChanged || epochChanged) {
        this.setData({ _lastPairId: pairId, _lastLoadedAt: 0, _lastPairEpoch: pairEpoch })
        this.loadEntries(true)
        this.loadTodayAnns()
      } else if (!hasData || !isFresh) {
        this.loadEntries(!hasData)
        this.loadTodayAnns()
      }
    })
  },

  loadTodayAnns() {
    annService
      .listAnniversaries()
      .then((list) => {
        const todayAnns = annService.getTodaysAnniversaries(list || [])
        const todayBannerText = todayAnns.length
          ? '今日纪念：' + todayAnns.map((a) => a.title).join('、')
          : ''
        this.setData({ todayAnns, todayBannerText })
      })
      .catch((err) => {
        console.warn('loadTodayAnns soft-fail', err)
        this.setData({ todayAnns: [], todayBannerText: '' })
      })
  },

  loadEntries(showLoading) {
    if (showLoading) {
      this.setData({ loading: true })
    }
    entriesService
      .listEntries()
      .then((list) => {
        const myOpenid = app.globalData && app.globalData.openid
        const entries = (list || []).map((item) => {
          const isSelf = item.authorOpenid === myOpenid
          const authorLabel = isSelf ? '我' : 'TA'
          const images = item.imageFileIds || []
          
          return Object.assign({}, item, {
            authorLabel,
            relativeTime: formatRelativeTime(item.createdAt),
            bodyText: item.process || item.content || item.title || '',
            images,
            imageCount: images.length
          })
        })
        this.setData({ entries, loading: false, _lastLoadedAt: Date.now() })
      })
      .catch((err) => {
        console.error(err)
        this.setData({ loading: false })
        wx.showToast({ title: err.message || '加载失败', icon: 'none' })
      })
  },

  previewImages(e) {
    const idx = e.currentTarget.dataset.idx
    const id = e.currentTarget.dataset.id
    const entry = this.data.entries.find(e => e._id === id)
    if (!entry || !entry.images || entry.images.length === 0) return
    
    wx.previewImage({
      current: entry.images[idx],
      urls: entry.images
    })
  },

  goPair() {
    wx.switchTab({ url: '/pages/pair/index' })
  },

  goAnniversaries() {
    wx.switchTab({ url: '/pages/anniversaries/index' })
  },

  goEdit() {
    if (!app.globalData || !app.globalData.pairId) {
      wx.showToast({ title: '请先完成登录/创建空间', icon: 'none' })
      wx.switchTab({ url: '/pages/pair/index' })
      return
    }
    wx.navigateTo({ url: '/pages/feed/edit' })
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: '/pages/feed/detail?id=' + id })
  },

  onPullDownRefresh() {
    const boot = app.ensureLogin ? app.ensureLogin() : Promise.resolve()
    boot.then(() => {
      const paired = !!(app.globalData && app.globalData.pairId)
      const pairId = (app.globalData && app.globalData.pairId) || ''
      const pairEpoch = (app.globalData && app.globalData.pairEpoch) || 0
      this.setData({ paired, _lastPairId: pairId, _lastLoadedAt: 0, _lastPairEpoch: pairEpoch })
      if (!paired) {
        wx.stopPullDownRefresh()
        return
      }
      this.loadEntries(false)
      this.loadTodayAnns()
      setTimeout(() => wx.stopPullDownRefresh(), 400)
    })
  },
})
