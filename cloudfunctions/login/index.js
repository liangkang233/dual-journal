const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

/**
 * 返回当前调用者的 openid
 * @returns {{ openid: string }}
 */
exports.main = async () => {
  const { OPENID } = cloud.getWXContext()
  return { openid: OPENID }
}
