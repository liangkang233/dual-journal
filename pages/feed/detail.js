const app = getApp()
const entriesService = require('../../services/entries')

Page({
  data: {
    loading: true,
    entry: null,
    timeText: '',
    errorText: '',
  },

  onLoad(options) {
    const id = (options && options.id) || ''
    if (!id) {
      this.setData({ loading: false, errorText: '缺少见闻 ID' })
      return
    }
    if (!app.globalData || !app.globalData.pairId) {
      this.setData({ loading: false, errorText: '请先完成配对' })
      return
    }
    this.entryId = id
    this.loadDetail()
  },

  loadDetail() {
    this.setData({ loading: true, errorText: '' })
    entriesService
      .getEntry(this.entryId)
      .then((entry) => {
        if (!entry) {
          this.setData({
            loading: false,
            errorText: '见闻不存在或已删除',
          })
          return
        }
        this.setData({
          entry,
          timeText: this.formatTime(entry.createdAt),
          loading: false,
        })
      })
      .catch((err) => {
        console.error(err)
        this.setData({
          loading: false,
          errorText: err.message || '加载失败',
        })
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

  onPreview(e) {
    const urls = (this.data.entry && this.data.entry.imageFileIds) || []
    if (!urls.length) return
    const current = e.currentTarget.dataset.src || urls[0]
    wx.previewImage({ current, urls })
  },

  goPair() {
    wx.switchTab({ url: '/pages/pair/index' })
  },
})
