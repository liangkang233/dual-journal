const app = getApp()
const entriesService = require('../../services/entries')

const MAX_IMAGES = 9
const DRAFT_KEY = 'feed_edit_draft'

Page({
  data: {
    timeClock: '',
    timeDate: '',
    id: '',
    isEdit: false,
    title: '',
    timeAt: '',
    location: '',
    people: '',
    cause: '',
    process: '',
    result: '',
    tempFilePaths: [],
    submitting: false,
    maxImages: MAX_IMAGES,
  },

  onLoad(options) {
    const boot = app.ensureLogin ? app.ensureLogin() : Promise.resolve()
    boot.then(() => {
      if (!app.globalData || !app.globalData.pairId) {
        wx.showToast({ title: '请先完成登录/创建空间', icon: 'none' })
        setTimeout(() => {
          wx.switchTab({ url: '/pages/pair/index' })
        }, 400)
        return
      }
      const id = (options && options.id) || ''
      if (id) {
        this.setData({ id, isEdit: true })
        wx.setNavigationBarTitle({ title: '编辑见闻' })
        this.loadEntry(id)
        return
      }
      wx.setNavigationBarTitle({ title: '写见闻' })
      try {
        const draft = wx.getStorageSync(DRAFT_KEY)
        if (draft && typeof draft === 'object') {
          this.setData({
            title: draft.title || '',
            timeAt: draft.timeAt || '',
            location: draft.location || '',
            people: draft.people || '',
            cause: draft.cause || '',
            process: draft.process || draft.content || '',
            result: draft.result || '',
            tempFilePaths: draft.tempFilePaths || [],
          })
        }
      } catch (e) {
        // ignore
      }
    })
  },

  loadEntry(id) {
    wx.showLoading({ title: '加载中…', mask: true })
    entriesService
      .getEntry(id)
      .then((doc) => {
        wx.hideLoading()
        if (!doc) {
          wx.showToast({ title: '见闻不存在', icon: 'none' })
          setTimeout(() => wx.navigateBack({ delta: 1 }), 400)
          return
        }
        this.setData({
          title: doc.title || '',
          timeAt: doc.timeAt || '',
          location: doc.location || '',
          people: doc.people || '',
          cause: doc.cause || '',
          process: doc.process || doc.content || '',
          result: doc.result || '',
        })
      })
      .catch((err) => {
        wx.hideLoading()
        wx.showToast({ title: err.message || '加载失败', icon: 'none' })
      })
  },


  syncDateTimeField(dateKey, clockKey, targetKey) {
    const date = this.data[dateKey] || ''
    const clock = this.data[clockKey] || ''
    const timeAt = date ? (date + (clock ? ' ' + clock : '')) : ''
    this.setData({ [targetKey]: timeAt })
  },
  onTimeDateChange(e) {
    this.setData({ timeDate: e.detail.value })
    this.syncDateTimeField('timeDate', 'timeClock', 'timeAt')
  },
  onTimeClockChange(e) {
    this.setData({ timeClock: e.detail.value })
    this.syncDateTimeField('timeDate', 'timeClock', 'timeAt')
  },

  onFieldInput(e) {
    const key = e.currentTarget.dataset.field
    if (!key) return
    const patch = {}
    patch[key] = e.detail.value || ''
    this.setData(patch)
    this.saveDraft()
  },

  saveDraft() {
    if (this.data.isEdit) return
    try {
      wx.setStorageSync(DRAFT_KEY, {
        title: this.data.title,
        timeAt: this.data.timeAt,
        location: this.data.location,
        people: this.data.people,
        cause: this.data.cause,
        process: this.data.process,
        result: this.data.result,
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
      wx.showToast({ title: '请先完成登录/创建空间', icon: 'none' })
      wx.switchTab({ url: '/pages/pair/index' })
      return
    }
    const payload = {
      title: (this.data.title || '').trim(),
      timeAt: (this.data.timeAt || '').trim(),
      location: (this.data.location || '').trim(),
      people: (this.data.people || '').trim(),
      cause: (this.data.cause || '').trim(),
      process: (this.data.process || '').trim(),
      result: (this.data.result || '').trim(),
      content: (this.data.process || '').trim(),
      tempFilePaths: this.data.tempFilePaths,
    }
    if (
      !payload.title &&
      !payload.process &&
      !payload.result &&
      !this.data.tempFilePaths.length
    ) {
      wx.showToast({ title: '请至少填写标题、经过或结果', icon: 'none' })
      return
    }

    this.setData({ submitting: true })
    wx.showLoading({ title: '提交中…', mask: true })

    const run = this.data.isEdit
      ? entriesService.updateEntry(this.data.id, payload)
      : entriesService.createEntry(payload)

    run
      .then(() => {
        wx.hideLoading()
        this.clearDraft()
        wx.showToast({ title: this.data.isEdit ? '已保存' : '已发布', icon: 'success' })
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
