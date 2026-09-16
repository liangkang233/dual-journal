const app = getApp()
const annService = require('../../services/anniversaries')
const { isAnniversaryToday } = require('../../utils/anniversary')
const { applyPairBackground } = require('../../utils/background')
const { generateCalendarMatrix, getPrevMonth, getNextMonth, formatMonthTitle } = require('../../utils/calendar')
const { getUpcomingAnniversaries } = require('../../utils/upcomingAnniversaries')

Page({
  data: {
    paired: false,
    loading: false,
    list: [],
    todayList: [],
    emptyTitle: '暂无纪念日',
    emptyDesc: '登录后会自动创建个人空间；也可邀请对方一起记录',
    bgClass: 'page-bg page-bg-warm',
    bgStyle: '',
    
    // TTL 缓存相关
    _lastPairId: '',
    _lastLoadedAt: 0,
    _lastPairEpoch: 0,
    
    // 视图模式: 'calendar' 或 'list'
    viewMode: 'calendar',
    
    // 日历数据
    currentYear: new Date().getFullYear(),
    currentMonth: new Date().getMonth() + 1,
    monthTitle: '',
    calendarMatrix: [],
    calendarCells: [],
    anniversaryDates: {},
    
    // 列表数据
    upcomingList: [],
  },

  onShow() {
    applyPairBackground(this)
    
    // 从缓存中恢复视图模式
    const savedViewMode = wx.getStorageSync('anniversaries_view_mode') || 'calendar'
    this.setData({ viewMode: savedViewMode })
    
    const boot = app.ensureLogin ? app.ensureLogin() : Promise.resolve()
    boot.then(() => {
      const paired = !!(app.globalData && app.globalData.pairId)
      const pairId = (app.globalData && app.globalData.pairId) || ''
      const pairEpoch = (app.globalData && app.globalData.pairEpoch) || 0
      this.setData({ paired })
      if (!paired) {
        this.setData({ _lastPairId: '', _lastLoadedAt: 0, _lastPairEpoch: 0 })
        return
      }

      const now = Date.now()
      const lastPairId = this.data._lastPairId
      const lastLoadedAt = this.data._lastLoadedAt
      const lastPairEpoch = this.data._lastPairEpoch
      const hasData = this.data.list && this.data.list.length > 0
      const TTL = 20 * 1000
      const isFresh = pairId === lastPairId && (now - lastLoadedAt) < TTL
      const pairChanged = pairId !== lastPairId
      const epochChanged = pairEpoch !== lastPairEpoch

      if (pairChanged || epochChanged) {
        this.setData({ _lastPairId: pairId, _lastLoadedAt: 0, _lastPairEpoch: pairEpoch })
        this.loadList(true)
      } else if (!hasData || !isFresh) {
        this.loadList(!hasData)
      }
    })
  },

  loadList(showLoading) {
    if (showLoading) {
      this.setData({ loading: true })
    }
    annService
      .listAnniversaries()
      .then((raw) => {
        const now = new Date()
        const list = (raw || []).map((item) =>
          Object.assign({}, item, {
            isToday: isAnniversaryToday(item, now),
            dateLabel: item.date || '',
            repeatLabel: item.repeatYearly ? '每年重复' : '仅一次',
          })
        )
        const todayList = list.filter((i) => i.isToday)
        
        // 计算即将到来的纪念日
        const upcomingList = getUpcomingAnniversaries(list, now)
        
        // 构建日历视图的纪念日映射
        const anniversaryDates = {}
        list.forEach(ann => {
          if (ann.date) {
            // 提取月-日部分
            const parts = ann.date.split('-')
            let key
            if (parts.length === 3) {
              // YYYY-MM-DD 格式
              if (ann.repeatYearly) {
                key = `${parts[1]}-${parts[2]}` // 每年重复只记 MM-DD
              } else {
                key = ann.date // 一次性的记完整日期
              }
            } else if (parts.length === 2) {
              key = ann.date // MM-DD 格式
            }
            
            if (key) {
              if (!anniversaryDates[key]) {
                anniversaryDates[key] = []
              }
              anniversaryDates[key].push(ann)
            }
          }
        })
        
        this.setData({ 
          list, 
          todayList, 
          upcomingList,
          anniversaryDates,
          loading: false,
          _lastLoadedAt: Date.now()
        })
        
        this.updateCalendar()
      })
      .catch((err) => {
        console.error(err)
        this.setData({ loading: false })
        wx.showToast({ title: err.message || '加载失败', icon: 'none' })
      })
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
    const id =
      e && e.currentTarget && e.currentTarget.dataset
        ? e.currentTarget.dataset.id
        : ''
    if (id) {
      wx.navigateTo({ url: '/pages/anniversaries/edit?id=' + id })
    } else {
      wx.navigateTo({ url: '/pages/anniversaries/edit' })
    }
  },

  onDelete(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.showModal({
      title: '删除纪念日',
      content: '确定删除这条纪念日吗？',
      confirmText: '删除',
      confirmColor: '#e64340',
      success: (res) => {
        if (!res.confirm) return
        annService
          .removeAnniversary(id)
          .then(() => {
            wx.showToast({ title: '已删除', icon: 'success' })
            this.loadList(false)
          })
          .catch((err) => {
            wx.showToast({ title: err.message || '删除失败', icon: 'none' })
          })
      },
    })
  },

  updateCalendar() {
    const { currentYear, currentMonth, anniversaryDates } = this.data
    const matrix = generateCalendarMatrix(currentYear, currentMonth)
    const monthTitle = formatMonthTitle(currentYear, currentMonth)
    
    // 为每个日期添加是否有纪念日的标记
    matrix.forEach(week => {
      week.forEach(day => {
        if (day.date) {
          const mmdd = day.date.substring(5) // 提取 MM-DD
          const fullDate = day.date // YYYY-MM-DD
          day.hasAnniversary = !!(anniversaryDates[mmdd] || anniversaryDates[fullDate])
        }
      })
    })
    
    const calendarCells = []
    matrix.forEach((week) => {
      week.forEach((day) => calendarCells.push(day))
    })
    this.setData({ calendarMatrix: matrix, calendarCells, monthTitle })
  },
  
  toggleViewMode() {
    const newMode = this.data.viewMode === 'calendar' ? 'list' : 'calendar'
    this.setData({ viewMode: newMode })
    
    // 保存到缓存
    wx.setStorageSync('anniversaries_view_mode', newMode)
  },
  
  prevMonth() {
    const { currentYear, currentMonth } = this.data
    const prev = getPrevMonth(currentYear, currentMonth)
    this.setData({
      currentYear: prev.year,
      currentMonth: prev.month
    })
    this.updateCalendar()
  },
  
  nextMonth() {
    const { currentYear, currentMonth } = this.data
    const next = getNextMonth(currentYear, currentMonth)
    this.setData({
      currentYear: next.year,
      currentMonth: next.month
    })
    this.updateCalendar()
  },
  
  onDayTap(e) {
    const date = e.currentTarget.dataset.date
    if (!date) return
    
    const mmdd = date.substring(5)
    const { anniversaryDates } = this.data
    const anns = anniversaryDates[mmdd] || anniversaryDates[date] || []
    
    if (anns.length > 0) {
      const titles = anns.map(a => a.title).join('、')
      wx.showModal({
        title: date,
        content: titles,
        showCancel: false
      })
    }
  },

  onPullDownRefresh() {
    if (!this.data.paired) {
      wx.stopPullDownRefresh()
      return
    }
    const pairId = (app.globalData && app.globalData.pairId) || ''
    const pairEpoch = (app.globalData && app.globalData.pairEpoch) || 0
    this.setData({ _lastPairId: pairId, _lastLoadedAt: 0, _lastPairEpoch: pairEpoch })
    this.loadList(false)
    setTimeout(() => wx.stopPullDownRefresh(), 400)
  },
})
