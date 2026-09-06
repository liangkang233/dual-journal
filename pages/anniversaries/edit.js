const app = getApp()
const annService = require('../../services/anniversaries')

Page({
  data: {
    id: '',
    title: '',
    date: '',
    repeatYearly: true,
    location: '',
    people: '',
    cause: '',
    process: '',
    result: '',
    submitting: false,
    isEdit: false,
  },

  onLoad(options) {
    const boot = app.ensureLogin ? app.ensureLogin() : Promise.resolve()
    boot.then(() => this._afterLogin(options))
  },

  _afterLogin(options) {
    if (!app.globalData || !app.globalData.pairId) {
      wx.showToast({ title: '请先完成登录/创建空间', icon: 'none' })
      setTimeout(() => {
        wx.switchTab({ url: '/pages/pair/index' })
      }, 400)
      return
    }

    const id = (options && options.id) || ''
    if (!id) {
      const d = new Date()
      const pad = (n) => (n < 10 ? '0' + n : '' + n)
      const date =
        d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
      this.setData({ date })
      wx.setNavigationBarTitle({ title: '新建纪念日' })
      return
    }

    this.setData({ id, isEdit: true })
    wx.setNavigationBarTitle({ title: '编辑纪念日' })
    this.loadItem(id)
  },

  loadItem(id) {
    wx.showLoading({ title: '加载中…', mask: true })
    annService
      .getAnniversary(id)
      .then((doc) => {
        wx.hideLoading()
        if (!doc) {
          wx.showToast({ title: '纪念日不存在', icon: 'none' })
          setTimeout(() => wx.navigateBack({ delta: 1 }), 400)
          return
        }
        this.setData({
          title: doc.title || '',
          date: doc.date || '',
          repeatYearly: doc.repeatYearly !== false,
          location: doc.location || '',
          people: doc.people || '',
          cause: doc.cause || '',
          process: doc.process || '',
          result: doc.result || '',
        })
      })
      .catch((err) => {
        wx.hideLoading()
        wx.showToast({ title: err.message || '加载失败', icon: 'none' })
      })
  },

  onTitleInput(e) {
    this.setData({ title: e.detail.value || '' })
  },

  onFieldInput(e) {
    const key = e.currentTarget.dataset.field
    if (!key) return
    const patch = {}
    patch[key] = e.detail.value || ''
    this.setData(patch)
  },

  onDateChange(e) {
    this.setData({ date: e.detail.value || '' })
  },

  onRepeatChange(e) {
    this.setData({ repeatYearly: !!(e.detail && e.detail.value) })
  },

  onSubmit() {
    if (this.data.submitting) return
    if (!app.globalData || !app.globalData.pairId) {
      wx.showToast({ title: '请先完成登录/创建空间', icon: 'none' })
      wx.switchTab({ url: '/pages/pair/index' })
      return
    }

    const title = (this.data.title || '').trim()
    if (!title) {
      wx.showToast({ title: '请填写标题', icon: 'none' })
      return
    }
    if (!this.data.date) {
      wx.showToast({ title: '请选择日期', icon: 'none' })
      return
    }

    this.setData({ submitting: true })
    wx.showLoading({ title: '保存中…', mask: true })

    const payload = {
      title,
      date: this.data.date,
      repeatYearly: this.data.repeatYearly,
      location: (this.data.location || '').trim(),
      people: (this.data.people || '').trim(),
      cause: (this.data.cause || '').trim(),
      process: (this.data.process || '').trim(),
      result: (this.data.result || '').trim(),
    }
    if (this.data.id) {
      payload._id = this.data.id
    }

    annService
      .upsertAnniversary(payload)
      .then(() => {
        wx.hideLoading()
        wx.showToast({ title: '已保存', icon: 'success' })
        setTimeout(() => {
          wx.navigateBack({ delta: 1 })
        }, 400)
      })
      .catch((err) => {
        wx.hideLoading()
        this.setData({ submitting: false })
        wx.showToast({ title: err.message || '保存失败', icon: 'none' })
      })
  },
})
