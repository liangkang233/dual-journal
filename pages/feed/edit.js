const app = getApp()
const entriesService = require('../../services/entries')

const MAX_IMAGES = 9
const DRAFT_KEY = 'feed_edit_draft'

Page({
  data: {
    title: '',
    content: '',
    tempFilePaths: [],
    submitting: false,
    maxImages: MAX_IMAGES,
  },

  onLoad() {
    if (!app.globalData || !app.globalData.pairId) {
      wx.showToast({ title: '请先完成配对', icon: 'none' })
      setTimeout(() => {
        wx.switchTab({ url: '/pages/pair/index' })
      }, 400)
      return
    }
    try {
      const draft = wx.getStorageSync(DRAFT_KEY)
      if (draft && typeof draft === 'object') {
        this.setData({
          title: draft.title || '',
          content: draft.content || '',
          tempFilePaths: draft.tempFilePaths || [],
        })
      }
    } catch (e) {
      // ignore
    }
  },

  onTitleInput(e) {
    this.setData({ title: e.detail.value || '' })
    this.saveDraft()
  },

  onContentInput(e) {
    this.setData({ content: e.detail.value || '' })
    this.saveDraft()
  },

  saveDraft() {
    try {
      wx.setStorageSync(DRAFT_KEY, {
        title: this.data.title,
        content: this.data.content,
        tempFilePaths: this.data.tempFilePaths,
      })
    } catch (e) {
      // ignore
    }
  },

  clearDraft() {
    try {
      wx.removeStorageSync(DRAFT_KEY)
    } catch (e) {
      // ignore
    }
  },

  onChooseImages() {
    const remain = MAX_IMAGES - this.data.tempFilePaths.length
    if (remain <= 0) {
      wx.showToast({ title: '最多 9 张图片', icon: 'none' })
      return
    }
    wx.chooseImage({
      count: remain,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const paths = (res.tempFilePaths || []).concat([])
        const next = this.data.tempFilePaths.concat(paths).slice(0, MAX_IMAGES)
        this.setData({ tempFilePaths: next })
        this.saveDraft()
      },
    })
  },

  onRemoveImage(e) {
    const idx = e.currentTarget.dataset.index
    const list = this.data.tempFilePaths.slice()
    list.splice(idx, 1)
    this.setData({ tempFilePaths: list })
    this.saveDraft()
  },

  onPreviewLocal(e) {
    const idx = e.currentTarget.dataset.index
    wx.previewImage({
      current: this.data.tempFilePaths[idx],
      urls: this.data.tempFilePaths,
    })
  },

  onSubmit() {
    if (this.data.submitting) return
    if (!app.globalData || !app.globalData.pairId) {
      wx.showToast({ title: '请先完成配对', icon: 'none' })
      wx.switchTab({ url: '/pages/pair/index' })
      return
    }
    const title = (this.data.title || '').trim()
    const content = (this.data.content || '').trim()
    if (!title && !content && !this.data.tempFilePaths.length) {
      wx.showToast({ title: '请填写内容或添加图片', icon: 'none' })
      return
    }

    this.setData({ submitting: true })
    wx.showLoading({ title: '提交中…', mask: true })

    entriesService
      .createEntry({
        title,
        content,
        tempFilePaths: this.data.tempFilePaths,
      })
      .then(() => {
        wx.hideLoading()
        this.clearDraft()
        wx.showToast({ title: '已发布', icon: 'success' })
        setTimeout(() => {
          wx.navigateBack({ delta: 1 })
        }, 400)
      })
      .catch((err) => {
        wx.hideLoading()
        this.setData({ submitting: false })
        wx.showToast({ title: err.message || '提交失败', icon: 'none' })
      })
  },
})
