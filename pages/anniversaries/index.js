const app = getApp()

Page({
  data: {
    paired: false,
    emptyTitle: '暂无纪念日',
    emptyDesc: '完成配对后，一起记录重要日子',
  },

  onShow() {
    const paired = !!(app.globalData && app.globalData.pairId)
    this.setData({ paired })
  },

  goPair() {
    wx.switchTab({ url: '/pages/pair/index' })
  },
})
