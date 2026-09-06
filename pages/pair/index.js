const app = getApp()
const pairService = require('../../services/pair')
const { isInviteCodeFormat } = require('../../utils/invite')

Page({
  data: {
    paired: false,
    memberCount: 0,
    openid: '',
    inviteCode: '',
    inviteExpireAt: 0,
    expireText: '',
    inputCode: '',
    loading: false,
    statusText: '加载中…',
  },

  onLoad(options) {
    const fromQuery = (options && (options.inviteCode || options.code)) || ''
    if (fromQuery) {
      this.setData({ inputCode: String(fromQuery).trim().toUpperCase() })
    }
  },

  onShow() {
    this.refresh()
  },

  onShareAppMessage() {
    const code = this.data.inviteCode
    const path = code
      ? `/pages/pair/index?inviteCode=${code}`
      : '/pages/pair/index'
    return {
      title: code ? `邀请你加入双人见闻，码：${code}` : '一起来用双人见闻',
      path,
    }
  },

  refresh() {
    const openid = (app.globalData && app.globalData.openid) || ''
    this.setData({ openid, loading: true, statusText: '同步配对状态…' })

    const run = () =>
      pairService
        .getMyPair()
        .then((pair) => {
          if (!pair) {
            this.setData({
              paired: false,
              memberCount: 0,
              inviteCode: '',
              inviteExpireAt: 0,
              expireText: '',
              loading: false,
              statusText: '尚未配对，可生成邀请码或输入对方的码加入',
            })
            return
          }
          const members = pair.memberOpenids || []
          const paired = members.length >= 2
          const expireText = pair.inviteExpireAt
            ? this.formatExpire(pair.inviteExpireAt)
            : ''
          this.setData({
            paired,
            memberCount: members.length,
            inviteCode: pair.inviteActive ? pair.inviteCode || '' : '',
            inviteExpireAt: pair.inviteExpireAt || 0,
            expireText,
            loading: false,
            statusText: paired
              ? '已配对，两人共享同一份见闻本'
              : '已创建空间，等待对方加入（最多 2 人）',
          })
        })
        .catch((err) => {
          console.error(err)
          this.setData({
            loading: false,
            statusText: err.message || '加载失败',
          })
        })

    if (!openid && app.ensureLogin) {
      return app.ensureLogin().then(run)
    }
    return run()
  },

  formatExpire(ts) {
    const d = new Date(ts)
    const pad = (n) => (n < 10 ? '0' + n : '' + n)
    return (
      d.getFullYear() +
      '-' +
      pad(d.getMonth() + 1) +
      '-' +
      pad(d.getDate()) +
      ' ' +
      pad(d.getHours()) +
      ':' +
      pad(d.getMinutes())
    )
  },

  onInputCode(e) {
    const v = (e.detail.value || '').toUpperCase()
    this.setData({ inputCode: v })
  },

  onGenerate() {
    if (this.data.loading) return
    if (this.data.paired) {
      wx.showToast({ title: '已满员，无法生成', icon: 'none' })
      return
    }
    this.setData({ loading: true })
    pairService
      .createInvite()
      .then((res) => {
        this.setData({
          inviteCode: res.inviteCode,
          inviteExpireAt: res.inviteExpireAt,
          expireText: this.formatExpire(res.inviteExpireAt),
          memberCount: Math.max(this.data.memberCount, 1),
          loading: false,
          statusText: '邀请码已生成，48 小时内有效，可分享给对方',
        })
        wx.showToast({ title: '已生成邀请码', icon: 'success' })
        return pairService.getMyPair()
      })
      .catch((err) => {
        this.setData({ loading: false })
        wx.showToast({ title: err.message || '生成失败', icon: 'none' })
      })
  },

  onAccept() {
    if (this.data.loading) return
    const code = (this.data.inputCode || '').trim().toUpperCase()
    if (!isInviteCodeFormat(code)) {
      wx.showToast({ title: '请输入 6 位邀请码', icon: 'none' })
      return
    }
    this.setData({ loading: true })
    pairService
      .acceptInvite(code)
      .then(() => {
        wx.showToast({ title: '加入成功', icon: 'success' })
        return this.refresh()
      })
      .catch((err) => {
        this.setData({ loading: false })
        wx.showToast({ title: err.message || '加入失败', icon: 'none' })
      })
  },

  onCopyCode() {
    const code = this.data.inviteCode
    if (!code) return
    wx.setClipboardData({
      data: code,
      success() {
        wx.showToast({ title: '已复制', icon: 'success' })
      },
    })
  },
})
