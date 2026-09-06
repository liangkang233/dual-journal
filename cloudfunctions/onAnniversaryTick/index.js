/**
 * onAnniversaryTick — 定时扫描当日纪念日并尝试发送订阅消息
 *
 * 【部署说明】
 * 1. 在微信开发者工具中上传并部署本云函数
 * 2. 在云开发控制台 → 云函数 → onAnniversaryTick → 触发器 中配置定时触发器
 *    建议 cron：每天上午 9:00（示例）`0 0 9 * * * *`
 * 3. 将下方 SUBSCRIBE_TMPL_ID 替换为公众平台申请的订阅消息模板 ID
 * 4. 发送失败静默降级：不影响应用内「今日纪念」横幅
 */

const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

/** 订阅消息模板 ID 占位符 —— 开通后请替换 */
const SUBSCRIBE_TMPL_ID = 'SUBSCRIBE_TMPL_ID'

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

function isAnniversaryToday(ann, nowDate) {
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

/**
 * 分页拉取集合全部文档（云函数端）
 */
async function fetchAll(collection, where) {
  const MAX = 100
  let skip = 0
  const all = []
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await collection.where(where || {}).skip(skip).limit(MAX).get()
    const batch = res.data || []
    all.push(...batch)
    if (batch.length < MAX) break
    skip += MAX
  }
  return all
}

exports.main = async () => {
  const db = cloud.database()
  const now = new Date()
  const summary = {
    ok: true,
    scanned: 0,
    todayCount: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
  }

  try {
    const anniversaries = await fetchAll(db.collection('anniversaries'), {})
    summary.scanned = anniversaries.length

    const todayList = anniversaries.filter((a) => isAnniversaryToday(a, now))
    summary.todayCount = todayList.length

    if (!todayList.length) {
      return summary
    }

    // 按 pairId 聚合今日标题
    const byPair = {}
    todayList.forEach((ann) => {
      const pid = ann.pairId
      if (!pid) return
      if (!byPair[pid]) byPair[pid] = []
      byPair[pid].push(ann.title || '纪念日')
    })

    const pairIds = Object.keys(byPair)

    for (let i = 0; i < pairIds.length; i++) {
      const pairId = pairIds[i]
      const titles = byPair[pairId]
      const titleText = titles.slice(0, 3).join('、')
      const thing2 = titles.length > 1 ? `共 ${titles.length} 个纪念日` : '今天是重要日子'

      let subs = []
      try {
        const subRes = await db
          .collection('subscriptions')
          .where({
            pairId,
            templateId: SUBSCRIBE_TMPL_ID,
          })
          .get()
        subs = subRes.data || []
      } catch (err) {
        console.error('load subscriptions failed', pairId, err)
        summary.failed += 1
        continue
      }

      if (!subs.length) {
        summary.skipped += 1
        continue
      }

      for (let j = 0; j < subs.length; j++) {
        const sub = subs[j]
        if (!sub.openid) {
          summary.skipped += 1
          continue
        }
        try {
          await cloud.openapi.subscribeMessage.send({
            touser: sub.openid,
            templateId: SUBSCRIBE_TMPL_ID,
            page: 'pages/anniversaries/index',
            data: {
              thing1: { value: String(titleText).slice(0, 20) || '纪念日' },
              thing2: { value: String(thing2).slice(0, 20) },
            },
          })
          summary.sent += 1
          try {
            await db
              .collection('subscriptions')
              .doc(sub._id)
              .update({ data: { lastSentAt: Date.now() } })
          } catch (updErr) {
            console.warn('update lastSentAt soft-fail', updErr)
          }
        } catch (sendErr) {
          // 静默降级：额度用尽 / 未授权 / 模板错误等
          console.warn('subscribeMessage.send soft-fail', sub.openid, sendErr)
          summary.failed += 1
        }
      }
    }
  } catch (err) {
    // 整体失败也不抛给调用方（定时触发器）
    console.error('onAnniversaryTick soft-fail', err)
    summary.ok = false
    summary.error = (err && err.message) || String(err)
  }

  return summary
}
