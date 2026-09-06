const app = getApp()
const entriesService = require('../../services/entries')

const MAX_IMAGES = 9
const DRAFT_KEY = 'feed_edit_draft'

function pad2(n) {
  return n < 10 ? '0' + n : '' + n
}

function nowDateClock() {
  const d = new Date()
  const timeDate =
    d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate())
  const timeClock = pad2(d.getHours()) + ':' + pad2(d.getMinutes())
  return {
    timeDate,
    timeClock,
    timeAt: timeDate + ' ' + timeClock,
  }
}

function parseTimeAt(str) {
  const s = String(str || '').trim()
  if (!s) return { timeDate: '', timeClock: '' }
  const m = s.match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}))?/)
  if (!m) return { timeDate: '', timeClock: '' }
  return { timeDate: m[1], timeClock: m[2] || '' }
}

Page({
  data: {
    timeClock: '',
    timeDate: '',
    id: '',
    isEdit: false,
    title: '',
    timeAt: '',
    location: '',
    latitude: null,
    longitude: null,
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
          const patch = {
            title: draft.title || '',
            timeAt: draft.timeAt || '',
            location: draft.location || '',
            latitude: draft.latitude != null ? draft.latitude : null,
            longitude: draft.longitude != null ? draft.longitude : null,
            people: draft.people || '',
            cause: draft.cause || '',
            process: draft.process || draft.content || '',
            result: draft.result || '',
            tempFilePaths: draft.tempFilePaths || [],
          }
          if (patch.timeAt) {
            const parsed = parseTimeAt(patch.timeAt)
            patch.timeDate = parsed.timeDate
            patch.timeClock = parsed.timeClock
          } else {
            const now = nowDateClock()
            patch.timeDate = now.timeDate
            patch.timeClock = now.timeClock
            patch.timeAt = now.timeAt
          }
          this.setData(patch)
          this.saveDraft()
          return
        }
      } catch (e) {
        // ignore
      }
      const now = nowDateClock()
      this.setData({
        timeDate: now.timeDate,
        timeClock: now.timeClock,
        timeAt: now.timeAt,
      })
      this.saveDraft()
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
        const timeAt = doc.timeAt || ''
        const parsed = parseTimeAt(timeAt)
        this.setData({
          title: doc.title || '',
          timeAt,
          timeDate: parsed.timeDate,
          timeClock: parsed.timeClock,
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
    const timeAt = date ? date + (clock ? ' ' + clock : '') : ''
    this.setData({ [targetKey]: timeAt })
    this.saveDraft()
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

  onPickLocation() {
    wx.chooseLocation({
      success: (res) => {
        const loc =
          [res.name, res.address].filter(Boolean).join(' · ') ||
          res.address ||
          res.name ||
          ''
        const patch = { location: loc }
        if (res.latitude != null) patch.latitude = res.latitude
        if (res.longitude != null) patch.longitude = res.longitude
        this.setData(patch)
        this.saveDraft()
      },
      fail: () => {
        wx.showToast({ title: '需授权位置或取消', icon: 'none' })
      },
    })
  },

  saveDraft() {
    if (this.data.isEdit) return
    try {
      wx.setStorageSync(DRAFT_KEY, {
        title: this.data.title,
        timeAt: this.data.timeAt,
        location: this.data.location,
        latitude: this.data.latitude,
        longitude: this.data.longitude,
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
