/**
 * Format remaining time until dueAt (ms).
 * @param {number|null|undefined} dueAt
 * @param {number} [now]
 * @returns {string}
 */
function formatCountdown(dueAt, now) {
  if (dueAt == null || dueAt === '') return ''
  const due = Number(dueAt)
  if (Number.isNaN(due)) return ''
  const t = now != null ? now : Date.now()
  const diff = due - t
  if (diff <= 0) {
    const past = -diff
    const days = Math.floor(past / (24 * 60 * 60 * 1000))
    if (days >= 1) return '已过期 ' + days + ' 天'
    const hours = Math.floor(past / (60 * 60 * 1000))
    if (hours >= 1) return '已过期 ' + hours + ' 小时'
    return '已到期'
  }
  const days = Math.floor(diff / (24 * 60 * 60 * 1000))
  if (days >= 1) return '剩余 ' + days + ' 天'
  const hours = Math.floor(diff / (60 * 60 * 1000))
  if (hours >= 1) return '剩余 ' + hours + ' 小时'
  const mins = Math.max(1, Math.floor(diff / (60 * 1000)))
  return '剩余 ' + mins + ' 分钟'
}

module.exports = {
  formatCountdown,
}
