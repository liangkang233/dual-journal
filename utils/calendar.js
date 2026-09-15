/**
 * 生成日历月矩阵
 * @param {number} year - 年份
 * @param {number} month - 月份 (1-12)
 * @returns {Array<Array<Object>>} 日历矩阵,每行7天
 */
function generateCalendarMatrix(year, month) {
  const firstDay = new Date(year, month - 1, 1)
  const lastDay = new Date(year, month, 0)
  const daysInMonth = lastDay.getDate()
  const startWeekday = firstDay.getDay() // 0=Sunday, 6=Saturday
  
  const matrix = []
  let week = []
  
  // 填充月初空白
  for (let i = 0; i < startWeekday; i++) {
    week.push({ day: null, date: null })
  }
  
  // 填充月份日期
  for (let day = 1; day <= daysInMonth; day++) {
    week.push({
      day,
      date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      isToday: isToday(year, month, day)
    })
    
    if (week.length === 7) {
      matrix.push(week)
      week = []
    }
  }
  
  // 填充月末空白
  if (week.length > 0) {
    while (week.length < 7) {
      week.push({ day: null, date: null })
    }
    matrix.push(week)
  }
  
  return matrix
}

/**
 * 判断是否为今天
 */
function isToday(year, month, day) {
  const now = new Date()
  return now.getFullYear() === year &&
         now.getMonth() + 1 === month &&
         now.getDate() === day
}

/**
 * 获取上个月的年月
 */
function getPrevMonth(year, month) {
  if (month === 1) {
    return { year: year - 1, month: 12 }
  }
  return { year, month: month - 1 }
}

/**
 * 获取下个月的年月
 */
function getNextMonth(year, month) {
  if (month === 12) {
    return { year: year + 1, month: 1 }
  }
  return { year, month: month + 1 }
}

/**
 * 格式化月份标题
 */
function formatMonthTitle(year, month) {
  return `${year}年${month}月`
}

module.exports = {
  generateCalendarMatrix,
  getPrevMonth,
  getNextMonth,
  formatMonthTitle
}
