const app = getApp()
const entriesService = require('../../services/entries')

Page({
  data: {
    loading: true,
    entry: null,
    timeText: '',
    errorText: '',
    showPairCta: false,
    id: '',
  },

  onLoad(options) {
    const id = (options && options.id) || ''
    if (!id) {
      this.setData({ loading: false, errorText: '缺少见闻 ID' })
      return
    }
    this.entryId = id
    this.setData({ id })
    const boot = app.ensureLogin ? app.ensureLogin() : Promise.resolve()
    boot.then(() => {
      if (!app.globalData || !app.globalData.pairId) {
        this.setData({ loading: false, errorText: '请先完成登录/创建空间', showPairCta: true })
        return
      }
      this.loadDetail()
    })
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

  goEdit() {
    if (!this.entryId) return
    wx.navigateTo({ url: '/pages/feed/edit?id=' + this.entryId })
  },

  onDelete() {
    if (!this.entryId) return
    wx.showModal({
      title: '删除见闻',
      content: '确定删除这条见闻吗？',
      confirmText: '删除',
      confirmColor: '#e64340',
      success: (res) => {
        if (!res.confirm) return
        entriesService
          .removeEntry(this.entryId)
          .then(() => {
            wx.showToast({ title: '已删除', icon: 'success' })
            setTimeout(() => wx.navigateBack({ delta: 1 }), 400)
          })
          .catch((err) => {
            wx.showToast({ title: err.message || '删除失败', icon: 'none' })
          })
      },
    })
  },
})
