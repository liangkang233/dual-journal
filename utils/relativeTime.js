/**
 * 将时间戳转换为相对时间字符串
 * @param {number|Date} timestamp - 时间戳或 Date 对象
 * @returns {string} 相对时间字符串,如"刚刚"、"5分钟前"、"昨天"等
 */
function formatRelativeTime(timestamp) {
  if (!timestamp) return ''
  
  const now = new Date()
  const then = typeof timestamp === 'number' ? new Date(timestamp) : timestamp
  const diffMs = now - then
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)
  
  if (diffSec < 60) {
    return '刚刚'
  } else if (diffMin < 60) {
    return `${diffMin}分钟前`
  } else if (diffHour < 24) {
    return `${diffHour}小时前`
  } else if (diffDay === 1) {
    return '昨天'
  } else if (diffDay === 2) {
    return '前天'
  } else if (diffDay < 7) {
    return `${diffDay}天前`
  } else if (diffDay < 30) {
    const weeks = Math.floor(diffDay / 7)
    return `${weeks}周前`
  } else if (diffDay < 365) {
    const months = Math.floor(diffDay / 30)
    return `${months}个月前`
  } else {
    const years = Math.floor(diffDay / 365)
    return `${years}年前`
  }
}

module.exports = { formatRelativeTime }
