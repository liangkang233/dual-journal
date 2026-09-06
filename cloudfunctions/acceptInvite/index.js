const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const CODE_RE = /^[A-Z0-9]{6}$/
const MAX_MEMBERS = 2

function isInviteCodeFormat(code) {
  return typeof code === 'string' && CODE_RE.test(code)
}

/**
 * 接受邀请码加入 pair
 * @param {{ inviteCode: string }} event
 * @returns {{ ok: true, pairId } | { ok: false, error }}
 */
exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) {
    return { ok: false, error: '未获取到登录态' }
  }

  const raw = (event && event.inviteCode) || ''
  const inviteCode = String(raw).trim().toUpperCase()

  if (!isInviteCodeFormat(inviteCode)) {
    return { ok: false, error: '邀请码格式不正确，请输入 6 位大写字母或数字' }
  }

  const now = Date.now()

  try {
    // 已在某个 pair 中则直接返回（避免重复加入）
    const mine = await db
      .collection('pairs')
      .where({ memberOpenids: OPENID })
      .limit(1)
      .get()

    if (mine.data && mine.data.length > 0) {
      const myPair = mine.data[0]
      if (myPair.inviteCode === inviteCode) {
        return { ok: true, pairId: myPair._id }
      }
      return { ok: false, error: '你已在其他配对中，无法再加入' }
    }

    const found = await db
      .collection('pairs')
      .where({
        inviteCode,
        inviteActive: true,
      })
      .limit(1)
      .get()

    if (!found.data || found.data.length === 0) {
      return { ok: false, error: '邀请码无效或已失效' }
    }

    const pair = found.data[0]
    const members = pair.memberOpenids || []

    if (members.includes(OPENID)) {
      return { ok: true, pairId: pair._id }
    }

    if (typeof pair.inviteExpireAt === 'number' && pair.inviteExpireAt < now) {
      await db
        .collection('pairs')
        .doc(pair._id)
        .update({
          data: { inviteActive: false, updatedAt: now },
        })
      return { ok: false, error: '邀请码已过期，请让对方重新生成' }
    }

    if (members.length >= MAX_MEMBERS) {
      await db
        .collection('pairs')
        .doc(pair._id)
        .update({
          data: { inviteActive: false, updatedAt: now },
        })
      return { ok: false, error: '该配对已满员（最多 2 人）' }
    }

    const newMembers = members.concat([OPENID])
    const full = newMembers.length >= MAX_MEMBERS

    await db
      .collection('pairs')
      .doc(pair._id)
      .update({
        data: {
          memberOpenids: newMembers,
          inviteActive: !full,
          updatedAt: now,
        },
      })

    return { ok: true, pairId: pair._id }
  } catch (err) {
    console.error('acceptInvite error', err)
    return { ok: false, error: err.message || '加入配对失败' }
  }
}
