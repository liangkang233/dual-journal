const app = getApp()
const todosService = require('../../services/todos')
const { sortTodos } = require('../../utils/todoSort')

const PRIORITY_LABEL = { high: '高', medium: '中', low: '低' }

Page({
  data: {
    paired: false,
    loading: false,
    todos: [],
    emptyTitle: '暂无待办',
    emptyDesc: '完成配对后，可一起管理待办事项',
  },

  onShow() {
    const paired = !!(app.globalData && app.globalData.pairId)
    this.setData({ paired })
    if (!paired) return
    this.loadTodos()
  },

  loadTodos() {
    this.setData({ loading: true })
    todosService
      .listTodos()
      .then((list) => {
        const sorted = sortTodos(list || [])
        const todos = sorted.map((item) =>
          Object.assign({}, item, {
            priorityLabel: PRIORITY_LABEL[item.priority] || '中',
            dueText: this.formatDue(item.dueAt),
            done: item.status === 'done',
          })
        )
        this.setData({ todos, loading: false })
      })
      .catch((err) => {
        console.error(err)
        this.setData({ loading: false })
        wx.showToast({ title: err.message || '加载失败', icon: 'none' })
      })
  },

  formatDue(ts) {
    if (!ts) return ''
    const d = new Date(ts)
    const pad = (n) => (n < 10 ? '0' + n : '' + n)
    return (
      d.getFullYear() +
      '-' +
      pad(d.getMonth() + 1) +
      '-' +
      pad(d.getDate())
    )
  },

  goPair() {
    wx.switchTab({ url: '/pages/pair/index' })
  },

  goEdit(e) {
    if (!app.globalData || !app.globalData.pairId) {
      wx.showToast({ title: '请先完成配对', icon: 'none' })
      wx.switchTab({ url: '/pages/pair/index' })
      return
    }
    const id = e && e.currentTarget && e.currentTarget.dataset
      ? e.currentTarget.dataset.id
      : ''
    if (id) {
      wx.navigateTo({ url: '/pages/todos/edit?id=' + id })
    } else {
      wx.navigateTo({ url: '/pages/todos/edit' })
    }
  },

  onToggle(e) {
    const id = e.currentTarget.dataset.id
    const done = e.currentTarget.dataset.done
    if (!id) return
    const nextStatus = done ? 'open' : 'done'
    todosService
      .setTodoStatus(id, nextStatus)
      .then(() => this.loadTodos())
      .catch((err) => {
        wx.showToast({ title: err.message || '更新失败', icon: 'none' })
      })
  },

  onDelete(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.showModal({
      title: '删除待办',
      content: '确定删除这条待办吗？',
      confirmText: '删除',
      confirmColor: '#e64340',
      success: (res) => {
        if (!res.confirm) return
        todosService
          .removeTodo(id)
          .then(() => {
            wx.showToast({ title: '已删除', icon: 'success' })
            this.loadTodos()
          })
          .catch((err) => {
            wx.showToast({ title: err.message || '删除失败', icon: 'none' })
          })
      },
    })
  },

  onPullDownRefresh() {
    if (!this.data.paired) {
      wx.stopPullDownRefresh()
      return
    }
    this.loadTodos()
    setTimeout(() => wx.stopPullDownRefresh(), 400)
  },
})
