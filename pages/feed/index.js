const app = getApp()

Page({
  data: {
    paired: false,
    emptyTitle: '暂无见闻',
    emptyDesc: '完成配对后，你们的共同见闻会出现在这里',
  },

  onShow() {
    const paired = !!(app.globalData && app.globalData.pairId)
    this.setData({ paired })
  },

  goPair() {
    wx.switchTab({ url: '/pages/pair/index' })
  },
})
