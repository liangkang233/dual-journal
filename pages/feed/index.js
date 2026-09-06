const app = getApp()
const entriesService = require('../../services/entries')
const annService = require('../../services/anniversaries')

Page({
  data: {
    paired: false,
    loading: false,
    entries: [],
    todayAnns: [],
    todayBannerText: '',
    emptyTitle: '暂无见闻',
    emptyDesc: '完成配对后，你们的共同见闻会出现在这里',
  },

  onShow() {
    const paired = !!(app.globalData && app.globalData.pairId)
    this.setData({ paired })
    if (!paired) {
      this.setData({ todayAnns: [], todayBannerText: '' })
      return
    }
    this.loadEntries()
    this.loadTodayAnns()
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
        // 应用内提醒失败静默：不影响见闻列表
        console.warn('loadTodayAnns soft-fail', err)
        this.setData({ todayAnns: [], todayBannerText: '' })
      })
  },

  loadEntries() {
    this.setData({ loading: true })
    entriesService
      .listEntries()
      .then((list) => {
        const entries = (list || []).map((item) =>
          Object.assign({}, item, {
            timeText: this.formatTime(item.createdAt),
            previewImages: (item.imageFileIds || []).slice(0, 3),
          })
        )
        this.setData({ entries, loading: false })
      })
      .catch((err) => {
        console.error(err)
        this.setData({ loading: false })
        wx.showToast({ title: err.message || '加载失败', icon: 'none' })
      })
  },

  formatTime(ts) {
    if (!ts) return ''
    const d = new Date(ts)
    const pad = (n) => (n < 10 ? '0' + n : '' + n)
    return (
      d.getFullYear() +
      '-' +
      pad(d.getMonth() + 1) +
      '-' +
      pad(d.getDate()) +
      ' ' +
      pad(d.getHours()) +
      ':' +
      pad(d.getMinutes())
    )
  },

  goPair() {
    wx.switchTab({ url: '/pages/pair/index' })
  },

  goAnniversaries() {
    wx.switchTab({ url: '/pages/anniversaries/index' })
  },

  goEdit() {
    if (!app.globalData || !app.globalData.pairId) {
      wx.showToast({ title: '请先完成配对', icon: 'none' })
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
    if (!this.data.paired) {
      wx.stopPullDownRefresh()
      return
    }
    this.loadEntries()
    this.loadTodayAnns()
    setTimeout(() => wx.stopPullDownRefresh(), 400)
  },
})
