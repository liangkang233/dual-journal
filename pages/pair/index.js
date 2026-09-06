const app = getApp()
const pairService = require('../../services/pair')
const { isInviteCodeFormat } = require('../../utils/invite')

/** 订阅消息模板 ID 占位符 —— 开通后请替换为真实模板 ID */
const SUBSCRIBE_TMPL_ID = 'SUBSCRIBE_TMPL_ID'

Page({
  data: {
    paired: false,
    hasPair: false,
    memberCount: 0,
    openid: '',
    inviteCode: '',
    inviteExpireAt: 0,
    expireText: '',
    inputCode: '',
    loading: false,
    statusText: '加载中…',
    subscribeAuthorized: false,
    subscribeHint: '授权后，纪念日当天尽量推送订阅消息；失败时仍可在应用内看到今日提醒。',
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
              hasPair: false,
              memberCount: 0,
              inviteCode: '',
              inviteExpireAt: 0,
              expireText: '',
              loading: false,
              statusText: '尚未配对，可生成邀请码或输入对方的码加入',
              subscribeAuthorized: false,
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
            hasPair: true,
            memberCount: members.length,
            inviteCode: pair.inviteActive ? pair.inviteCode || '' : '',
            inviteExpireAt: pair.inviteExpireAt || 0,
            expireText,
            loading: false,
            statusText: paired
              ? '已配对，两人共享同一份见闻本'
              : '已创建空间，等待对方加入（最多 2 人）',
          })
          return this.checkSubscription()
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

  checkSubscription() {
    const openid = (app.globalData && app.globalData.openid) || ''
    const pairId = (app.globalData && app.globalData.pairId) || ''
    if (!openid || !pairId) {
      this.setData({ subscribeAuthorized: false })
      return Promise.resolve()
    }
    const db = wx.cloud.database()
    return db
      .collection('subscriptions')
      .where({
        openid,
        pairId,
        templateId: SUBSCRIBE_TMPL_ID,
      })
      .limit(1)
      .get()
      .then((res) => {
        const ok = !!(res.data && res.data.length)
        this.setData({ subscribeAuthorized: ok })
      })
      .catch((err) => {
        console.warn('checkSubscription soft-fail', err)
        this.setData({ subscribeAuthorized: false })
      })
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
          hasPair: true,
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

  /**
   * 请求订阅消息授权，成功后写入 subscriptions 集合
   */
  onRequestSubscribe() {
    const pairId = (app.globalData && app.globalData.pairId) || ''
    const openid = (app.globalData && app.globalData.openid) || ''
    if (!pairId || !openid) {
      wx.showToast({ title: '请先完成配对', icon: 'none' })
      return
    }

    wx.requestSubscribeMessage({
      tmplIds: [SUBSCRIBE_TMPL_ID],
      success: (res) => {
        const status = res && res[SUBSCRIBE_TMPL_ID]
        if (status !== 'accept') {
          wx.showToast({
            title: status === 'reject' ? '已拒绝，仍可用应用内提醒' : '未授权订阅',
            icon: 'none',
          })
          return
        }
        this.saveSubscription(openid, pairId)
      },
      fail: (err) => {
        console.warn('requestSubscribeMessage soft-fail', err)
        wx.showToast({
          title: '订阅暂不可用，仍可用应用内提醒',
          icon: 'none',
        })
      },
    })
  },

  saveSubscription(openid, pairId) {
    const db = wx.cloud.database()
    const now = Date.now()
    db.collection('subscriptions')
      .where({
        openid,
        pairId,
        templateId: SUBSCRIBE_TMPL_ID,
      })
      .limit(1)
      .get()
      .then((res) => {
        const existing = res.data && res.data[0]
        if (existing) {
          return db
            .collection('subscriptions')
            .doc(existing._id)
            .update({
              data: {
                authorizedAt: now,
                updatedAt: now,
              },
            })
        }
        return db.collection('subscriptions').add({
          data: {
            openid,
            pairId,
            templateId: SUBSCRIBE_TMPL_ID,
            authorizedAt: now,
            lastSentAt: null,
            createdAt: now,
            updatedAt: now,
          },
        })
      })
      .then(() => {
        this.setData({ subscribeAuthorized: true })
        wx.showToast({ title: '已开启提醒', icon: 'success' })
      })
      .catch((err) => {
        console.warn('saveSubscription soft-fail', err)
        wx.showToast({
          title: '保存授权失败，仍可用应用内提醒',
          icon: 'none',
        })
      })
  },
})
