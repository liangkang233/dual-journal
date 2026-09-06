const app = getApp()
const todosService = require('../../services/todos')

Page({
  data: {
    id: '',
    title: '',
    priority: 'medium',
    dueDate: '',
    approxTime: '',
    timeAt: '',
    location: '',
    people: '',
    cause: '',
    process: '',
    result: '',
    status: 'open',
    submitting: false,
    isEdit: false,
    priorities: [
      { value: 'high', label: '高' },
      { value: 'medium', label: '中' },
      { value: 'low', label: '低' },
    ],
    statuses: [
      { value: 'open', label: '未完成' },
      { value: 'done', label: '已完成' },
    ],
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
      if (!id) {
        wx.setNavigationBarTitle({ title: '新建待办' })
        return
      }

      this.setData({ id, isEdit: true })
      wx.setNavigationBarTitle({ title: '编辑待办' })
      this.loadTodo(id)
    })
  },

  loadTodo(id) {
    wx.showLoading({ title: '加载中…', mask: true })
    todosService
      .getTodo(id)
      .then((doc) => {
        wx.hideLoading()
        if (!doc) {
          wx.showToast({ title: '待办不存在', icon: 'none' })
          setTimeout(() => wx.navigateBack({ delta: 1 }), 400)
          return
        }
        this.setData({
          title: doc.title || '',
          priority: doc.priority || 'medium',
          dueDate: doc.dueAt ? this.tsToDateStr(doc.dueAt) : '',
          approxTime: doc.approxTime || '',
          timeAt: doc.timeAt || '',
          location: doc.location || '',
          people: doc.people || '',
          cause: doc.cause || '',
          process: doc.process || '',
          result: doc.result || '',
          status: doc.status || 'open',
        })
      })
      .catch((err) => {
        wx.hideLoading()
        wx.showToast({ title: err.message || '加载失败', icon: 'none' })
      })
  },

  tsToDateStr(ts) {
    const d = new Date(ts)
    const pad = (n) => (n < 10 ? '0' + n : '' + n)
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
  },

  dateStrToTs(str) {
    if (!str) return null
    const parts = str.split('-')
    if (parts.length !== 3) return null
    const y = Number(parts[0])
    const m = Number(parts[1]) - 1
    const day = Number(parts[2])
    const d = new Date(y, m, day, 23, 59, 59, 0)
    const t = d.getTime()
    return Number.isNaN(t) ? null : t
  },

  onFieldInput(e) {
    const key = e.currentTarget.dataset.field
    if (!key) return
    const patch = {}
    patch[key] = e.detail.value || ''
    this.setData(patch)
  },

  onPriorityTap(e) {
    const value = e.currentTarget.dataset.value
    if (!value) return
    this.setData({ priority: value })
  },

  onStatusTap(e) {
    const value = e.currentTarget.dataset.value
    if (!value) return
    this.setData({ status: value })
  },

  onDueChange(e) {
    this.setData({ dueDate: e.detail.value || '' })
  },

  onClearDue() {
    this.setData({ dueDate: '' })
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

    this.setData({ submitting: true })
    wx.showLoading({ title: '保存中…', mask: true })

    const payload = {
      title,
      priority: this.data.priority,
      status: this.data.status,
      dueAt: this.dateStrToTs(this.data.dueDate),
      approxTime: (this.data.approxTime || '').trim(),
      timeAt: (this.data.timeAt || '').trim(),
      location: (this.data.location || '').trim(),
      people: (this.data.people || '').trim(),
      cause: (this.data.cause || '').trim(),
      process: (this.data.process || '').trim(),
      result: (this.data.result || '').trim(),
    }
    if (this.data.id) {
      payload._id = this.data.id
    }

    todosService
      .upsertTodo(payload)
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
