/**
 * 配对空间背景：预设与自定义解析
 */

const PRESETS = [
  { id: 'warm', label: '暖阳' },
  { id: 'mint', label: '薄荷' },
  { id: 'night', label: '夜色' },
  { id: 'plain', label: '简白' },
]

const PRESET_IDS = PRESETS.map((p) => p.id)

/**
 * 同步解析背景为页面 class / style（自定义图需再换临时 URL）
 * @param {{ type?: string, presetId?: string, fileId?: string }|null} background
 * @returns {{ bgClass: string, bgStyle: string, presetId: string, fileId: string }}
 */
function resolveBackground(background) {
  const bg = background || {}
  if (bg.type === 'custom' && bg.fileId) {
    return {
      bgClass: 'page-bg page-bg-custom',
      bgStyle: '',
      presetId: '',
      fileId: bg.fileId,
    }
  }
  const presetId = PRESET_IDS.indexOf(bg.presetId) >= 0 ? bg.presetId : 'plain'
  return {
    bgClass: 'page-bg page-bg-' + presetId,
    bgStyle: '',
    presetId: presetId,
    fileId: '',
  }
}

/**
 * 解析背景；自定义图通过 getTempFileURL 写入 bgStyle
 * @param {{ type?: string, presetId?: string, fileId?: string }|null} background
 * @returns {Promise<{ bgClass: string, bgStyle: string, presetId: string, fileId: string }>}
 */
function resolveBackgroundAsync(background) {
  const resolved = resolveBackground(background)
  if (!(background && background.type === 'custom' && background.fileId)) {
    return Promise.resolve(resolved)
  }
  if (!wx.cloud || !wx.cloud.getTempFileURL) {
    resolved.bgStyle =
      'background-image: url(' + background.fileId + ');'
    return Promise.resolve(resolved)
  }
  return wx.cloud
    .getTempFileURL({ fileList: [background.fileId] })
    .then((res) => {
      const item = res.fileList && res.fileList[0]
      const url = (item && item.tempFileURL) || background.fileId
      resolved.bgStyle = 'background-image: url(' + url + ');'
      return resolved
    })
    .catch(() => {
      resolved.bgStyle =
        'background-image: url(' + background.fileId + ');'
      return resolved
    })
}

/**
 * 从 app.globalData.pair 应用背景到页面 data
 * @param {WechatMiniprogram.Page.Instance} page
 * @param {object} [extraData]
 */
function applyPairBackground(page, extraData) {
  const app = getApp()
  const pair = (app && app.globalData && app.globalData.pair) || null
  const background = (pair && pair.background) || null
  return resolveBackgroundAsync(background).then((resolved) => {
    const data = Object.assign({}, extraData || {}, {
      bgClass: resolved.bgClass,
      bgStyle: resolved.bgStyle,
      bgPresetId: resolved.presetId,
      bgFileId: resolved.fileId,
    })
    page.setData(data)
    return resolved
  })
}

module.exports = {
  PRESETS,
  PRESET_IDS,
  resolveBackground,
  resolveBackgroundAsync,
  applyPairBackground,
}
