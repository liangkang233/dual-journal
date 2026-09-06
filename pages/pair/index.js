const app = getApp()

Page({
  data: {
    paired: false,
    emptyTitle: '尚未配对',
    emptyDesc: '在这里生成或输入邀请码，与另一半结成一对。配对功能将在后续版本开放。',
  },

  onShow() {
    const paired = !!(app.globalData && app.globalData.pairId)
    this.setData({ paired })
  },

  goPair() {
    wx.switchTab({ url: '/pages/pair/index' })
  },
})
