const app = getApp()
const todosService = require('../../services/todos')

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
    approxClock: '',
    approxDate: '',
    timeClock: '',
    timeDate: '',
    id: '',
    title: '',
    priority: 'medium',
    dueDate: '',
    approxTime: '',
    timeAt: '',
    location: '',
    latitude: null,
    longitude: null,
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
        const now = nowDateClock()
        this.setData({
          timeDate: now.timeDate,
          timeClock: now.timeClock,
          timeAt: now.timeAt,
          approxDate: now.timeDate,
          approxClock: now.timeClock,
          approxTime: now.timeAt,
        })
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
        const timeAt = doc.timeAt || ''
        const approxTime = doc.approxTime || ''
        const timeParsed = parseTimeAt(timeAt)
        const approxParsed = parseTimeAt(approxTime)
        this.setData({
          title: doc.title || '',
          priority: doc.priority || 'medium',
          dueDate: doc.dueAt ? this.tsToDateStr(doc.dueAt) : '',
          approxTime,
          approxDate: approxParsed.timeDate,
          approxClock: approxParsed.timeClock,
          timeAt,
          timeDate: timeParsed.timeDate,
          timeClock: timeParsed.timeClock,
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
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate())
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

  syncDateTimeField(dateKey, clockKey, targetKey) {
    const date = this.data[dateKey] || ''
    const clock = this.data[clockKey] || ''
    const timeAt = date ? date + (clock ? ' ' + clock : '') : ''
    this.setData({ [targetKey]: timeAt })
  },

  onApproxDateChange(e) {
    this.setData({ approxDate: e.detail.value })
    this.syncDateTimeField('approxDate', 'approxClock', 'approxTime')
  },
  onApproxClockChange(e) {
    this.setData({ approxClock: e.detail.value })
    this.syncDateTimeField('approxDate', 'approxClock', 'approxTime')
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
      },
      fail: () => {
        wx.showToast({ title: '需授权位置或取消', icon: 'none' })
      },
    })
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
