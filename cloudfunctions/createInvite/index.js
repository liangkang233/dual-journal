const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // 去掉易混字符
const INVITE_TTL_MS = 10 * 60 * 1000 // 10 minutes
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

  const db = cloud.database()
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

      // TC-SYNC-3: 过滤假伙伴，只计算真实成员数
      const realMembers = members.filter(id => 
        !(typeof id === 'string' && id.startsWith('dev_partner_'))
      )

      if (realMembers.length >= MAX_MEMBERS) {
        return { ok: false, error: '配对已满员，无法再生成邀请码' }
      }

      // TC-SYNC-3: 如果有假伙伴，自动清除它们
      const needsCleanup = members.length !== realMembers.length

      const updateData = {
        inviteCode,
        inviteExpireAt,
        inviteActive: true,
        updatedAt: now,
      }
      
      // TC-SYNC-3: 清除假伙伴
      if (needsCleanup) {
        updateData.memberOpenids = realMembers
      }

      await db
        .collection('pairs')
        .doc(pair._id)
        .update({
          data: updateData,
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
