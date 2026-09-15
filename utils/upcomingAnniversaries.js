/**
 * 计算纪念日的下一次出现日期
 * @param {Object} anniversary - 纪念日对象,包含 date 和 repeatYearly
 * @param {Date} fromDate - 从哪天开始计算(默认今天)
 * @returns {Object|null} { nextDate: Date, daysUntil: number, label: string }
 */
function getNextOccurrence(anniversary, fromDate = new Date()) {
  if (!anniversary || !anniversary.date) return null
  
  const parts = parseDateParts(anniversary.date)
  if (!parts) return null
  
  const now = new Date(fromDate)
  now.setHours(0, 0, 0, 0)
  
  if (anniversary.repeatYearly) {
    // 每年重复:找今年或明年的日期
    let nextYear = now.getFullYear()
    let nextDate = new Date(nextYear, parts.month - 1, parts.day)
    nextDate.setHours(0, 0, 0, 0)
    
    if (nextDate < now) {
      // 今年已过,取明年
      nextYear++
      nextDate = new Date(nextYear, parts.month - 1, parts.day)
      nextDate.setHours(0, 0, 0, 0)
    }
    
    const daysUntil = Math.floor((nextDate - now) / (24 * 60 * 60 * 1000))
    return {
      nextDate,
      daysUntil,
      label: formatOccurrenceLabel(daysUntil)
    }
  } else {
    // 仅一次:如果日期未来就返回,否则返回 null
    const targetDate = new Date(parts.year, parts.month - 1, parts.day)
    targetDate.setHours(0, 0, 0, 0)
    
    if (targetDate < now) {
      return null // 已过去
    }
    
    const daysUntil = Math.floor((targetDate - now) / (24 * 60 * 60 * 1000))
    return {
      nextDate: targetDate,
      daysUntil,
      label: formatOccurrenceLabel(daysUntil)
    }
  }
}

/**
 * 解析日期字符串
 */
function parseDateParts(dateStr) {
  const parts = String(dateStr).split('-').map(Number)
  if (parts.length === 3) {
    return { year: parts[0], month: parts[1], day: parts[2] }
  }
  if (parts.length === 2) {
    return { year: null, month: parts[0], day: parts[1] }
  }
  return null
}

/**
 * 格式化出现标签
 */
function formatOccurrenceLabel(daysUntil) {
  if (daysUntil === 0) return '今天'
  if (daysUntil === 1) return '明天'
  if (daysUntil === 2) return '后天'
  if (daysUntil < 7) return `${daysUntil}天后`
  if (daysUntil < 30) {
    const weeks = Math.floor(daysUntil / 7)
    return `${weeks}周后`
  }
  if (daysUntil < 365) {
    const months = Math.floor(daysUntil / 30)
    return `${months}个月后`
  }
  return `${Math.floor(daysUntil / 365)}年后`
}

/**
 * 获取即将到来的纪念日列表(今天及以后)
 */
function getUpcomingAnniversaries(anniversaries, fromDate = new Date()) {
  const upcoming = []
  
  for (const ann of anniversaries) {
    const next = getNextOccurrence(ann, fromDate)
    if (next) {
      upcoming.push({
        ...ann,
        nextDate: next.nextDate,
        daysUntil: next.daysUntil,
        label: next.label
      })
    }
  }
  
  // 按距离排序(最近的在前)
  upcoming.sort((a, b) => a.daysUntil - b.daysUntil)
  
  return upcoming
}

module.exports = {
  getNextOccurrence,
  getUpcomingAnniversaries
}
