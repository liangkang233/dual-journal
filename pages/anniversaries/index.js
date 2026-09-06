const app = getApp()
const annService = require('../../services/anniversaries')
const { isAnniversaryToday } = require('../../utils/anniversary')

Page({
  data: {
    paired: false,
    loading: false,
    list: [],
    todayList: [],
    emptyTitle: '暂无纪念日',
    emptyDesc: '完成配对后，一起记录重要日子',
  },

  onShow() {
    const paired = !!(app.globalData && app.globalData.pairId)
    this.setData({ paired })
    if (!paired) return
    this.loadList()
  },

  loadList() {
    this.setData({ loading: true })
    annService
      .listAnniversaries()
      .then((raw) => {
        const now = new Date()
        const list = (raw || []).map((item) =>
          Object.assign({}, item, {
            isToday: isAnniversaryToday(item, now),
            dateLabel: item.date || '',
            repeatLabel: item.repeatYearly ? '每年重复' : '仅一次',
          })
        )
        const todayList = list.filter((i) => i.isToday)
        this.setData({ list, todayList, loading: false })
      })
      .catch((err) => {
        console.error(err)
        this.setData({ loading: false })
        wx.showToast({ title: err.message || '加载失败', icon: 'none' })
      })
  },

  goPair() {
    wx.switchTab({ url: '/pages/pair/index' })
  },

  goEdit(e) {
    if (!app.globalData || !app.globalData.pairId) {
      wx.showToast({ title: '请先完成配对', icon: 'none' })
      wx.switchTab({ url: '/pages/pair/index' })
      return
    }
    const id =
      e && e.currentTarget && e.currentTarget.dataset
        ? e.currentTarget.dataset.id
        : ''
    if (id) {
      wx.navigateTo({ url: '/pages/anniversaries/edit?id=' + id })
    } else {
      wx.navigateTo({ url: '/pages/anniversaries/edit' })
    }
  },

  onDelete(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.showModal({
      title: '删除纪念日',
      content: '确定删除这条纪念日吗？',
      confirmText: '删除',
      confirmColor: '#e64340',
      success: (res) => {
        if (!res.confirm) return
        annService
          .removeAnniversary(id)
          .then(() => {
            wx.showToast({ title: '已删除', icon: 'success' })
            this.loadList()
          })
          .catch((err) => {
            wx.showToast({ title: err.message || '删除失败', icon: 'none' })
          })
      },
    })
  },

  onPullDownRefresh() {
    if (!this.data.paired) {
      wx.stopPullDownRefresh()
      return
    }
    this.loadList()
    setTimeout(() => wx.stopPullDownRefresh(), 400)
  },
})
