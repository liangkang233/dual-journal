const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const INVITE_TTL_MS = 48 * 60 * 60 * 1000 // 48 hours
const MAX_MEMBERS = 2

function generateInviteCode() {
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += CHARSET[Math.floor(Math.random() * CHARSET.length)]
  }
  return code
}

/**
 * 创建或刷新邀请码。已有 pair 且未满则刷新码；已满 2 人则报错。
 * @returns {{ ok: true, pairId, inviteCode, inviteExpireAt } | { ok: false, error }}
 */
exports.main = async () => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) {
    return { ok: false, error: '未获取到登录态' }
  }

  const now = Date.now()
  const inviteCode = generateInviteCode()
  const inviteExpireAt = now + INVITE_TTL_MS

  try {
    const found = await db
      .collection('pairs')
      .where({
        memberOpenids: OPENID,
      })
      .limit(1)
      .get()

    if (found.data && found.data.length > 0) {
      const pair = found.data[0]
      const members = pair.memberOpenids || []

      if (members.length >= MAX_MEMBERS) {
        return { ok: false, error: '配对已满员，无法再生成邀请码' }
      }

      await db
        .collection('pairs')
        .doc(pair._id)
        .update({
          data: {
            inviteCode,
            inviteExpireAt,
            inviteActive: true,
            updatedAt: now,
          },
        })

      return {
        ok: true,
        pairId: pair._id,
        inviteCode,
        inviteExpireAt,
      }
    }

    // 新建 pair：创建者作为第一位成员
    const addRes = await db.collection('pairs').add({
      data: {
        memberOpenids: [OPENID],
        inviteCode,
        inviteExpireAt,
        inviteActive: true,
        background: { type: 'preset', presetId: 'warm' },
        createdAt: now,
        updatedAt: now,
      },
    })

    return {
      ok: true,
      pairId: addRes._id,
      inviteCode,
      inviteExpireAt,
    }
  } catch (err) {
    console.error('createInvite error', err)
    return { ok: false, error: err.message || '创建邀请失败' }
  }
}
