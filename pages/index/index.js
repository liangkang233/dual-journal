Page({
  data: {
    title: '你好',
    tip: '这是一个最基础的可分享小程序',
  },
  onShareAppMessage() {
    return {
      title: '你好 — hello-share',
      path: '/pages/index/index',
    }
  },
})
