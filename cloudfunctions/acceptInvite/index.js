const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/
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
  const db = cloud.database()
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) {
    return { ok: false, error: '未获取到登录态' }
  }

  const raw = (event && event.inviteCode) || ''
  const inviteCode = String(raw).trim().toUpperCase()

  if (!isInviteCodeFormat(inviteCode)) {
    return { ok: false, error: '邀请码格式不正确，请输入 6 位字符（不含 0O1IL）' }
  }

  const now = Date.now()

  try {
    const mine = await db
      .collection('pairs')
      .where({ memberOpenids: OPENID })
      .get()

    let myPair = null
    if (mine.data && mine.data.length > 0) {
      if (mine.data.length === 1) {
        myPair = mine.data[0]
      } else {
        const twoPerson = mine.data.find(p => (p.memberOpenids || []).length >= 2)
        myPair = twoPerson || mine.data[0]
      }
      if (myPair.inviteCode === inviteCode) {
        return { ok: true, pairId: myPair._id }
      }
      const myMembers = myPair.memberOpenids || []
      if (myMembers.length >= 2) {
        return { ok: false, error: '你已在其他配对中，无法再加入' }
      }
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

    const updateData = {
      memberOpenids: newMembers,
      inviteActive: !full,
      updatedAt: now,
    }
    if (full) {
      updateData.inviteCode = ''
    }

    await db
      .collection('pairs')
      .doc(pair._id)
      .update({
        data: updateData,
      })

    if (myPair && myPair.memberOpenids && myPair.memberOpenids.length === 1) {
      const [entriesRes, todosRes, anniRes] = await Promise.all([
        db.collection('entries').where({ pairId: myPair._id }).count(),
        db.collection('todos').where({ pairId: myPair._id }).count(),
        db.collection('anniversaries').where({ pairId: myPair._id }).count(),
      ])
      
      const hasData = entriesRes.total > 0 || todosRes.total > 0 || anniRes.total > 0
      
      if (hasData) {
        const _ = db.command
        await Promise.all([
          db.collection('entries').where({ pairId: myPair._id }).update({ data: { pairId: pair._id } }),
          db.collection('todos').where({ pairId: myPair._id }).update({ data: { pairId: pair._id } }),
          db.collection('anniversaries').where({ pairId: myPair._id }).update({ data: { pairId: pair._id } }),
        ])
      }
      
      await db.collection('pairs').doc(myPair._id).remove()
    }

    return { ok: true, pairId: pair._id }
  } catch (err) {
    console.error('acceptInvite error', err)
    return { ok: false, error: err.message || '加入配对失败' }
  }
}
