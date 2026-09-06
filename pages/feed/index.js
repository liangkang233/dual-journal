Page({
  data: {
    msg: '见闻页已渲染（测试）',
  },
  onShow() {
    console.log('[feed] onShow ok')
  },
  goEdit() {
    wx.showToast({ title: '下一步恢复完整页', icon: 'none' })
  },
})
