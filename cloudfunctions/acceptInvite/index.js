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
    // 查询用户已加入的所有 pair
    const mine = await db
      .collection('pairs')
      .where({ memberOpenids: OPENID })
      .get()

    if (mine.data && mine.data.length > 0) {
      // 检查是否已在双人配对中
      const myDualPair = mine.data.find((p) => (p.memberOpenids || []).length >= 2)
      
      if (myDualPair) {
        if (myDualPair.inviteCode === inviteCode) {
          return { ok: true, pairId: myDualPair._id }
        }
        return { ok: false, error: '你已在其他配对中，无法再加入' }
      }
    }
    
    const existingSoloPairs = (mine.data || []).filter((p) => (p.memberOpenids || []).length === 1)

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

    // 标记旧的solo pair为inactive（软删除）
    if (existingSoloPairs && existingSoloPairs.length > 0) {
      for (const soloPair of existingSoloPairs) {
        try {
          await db
            .collection('pairs')
            .doc(soloPair._id)
            .update({
              data: {
                inviteActive: false,
                inactivatedAt: now,
                updatedAt: now,
              },
            })
        } catch (cleanupErr) {
          console.warn('cleanup solo pair failed', soloPair._id, cleanupErr)
        }
      }
    }

    return { ok: true, pairId: pair._id }
  } catch (err) {
    console.error('acceptInvite error', err)
    return { ok: false, error: err.message || '加入配对失败' }
  }
}
