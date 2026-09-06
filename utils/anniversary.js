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

function isAnniversaryToday(ann, nowDate = new Date()) {
  if (!ann || !ann.date) return false
  const parts = parseDateParts(ann.date)
  if (!parts) return false

  const month = nowDate.getMonth() + 1
  const day = nowDate.getDate()
  const year = nowDate.getFullYear()

  if (ann.repeatYearly) {
    return parts.month === month && parts.day === day
  }
  return parts.year === year && parts.month === month && parts.day === day
}

module.exports = { isAnniversaryToday }
