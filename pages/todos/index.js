const app = getApp()

Page({
  data: {
    paired: false,
    emptyTitle: '暂无待办',
    emptyDesc: '完成配对后，可一起管理待办事项',
  },

  onShow() {
    const paired = !!(app.globalData && app.globalData.pairId)
    this.setData({ paired })
  },

  goPair() {
    wx.switchTab({ url: '/pages/pair/index' })
  },
})
