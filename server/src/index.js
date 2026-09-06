const fs = require('fs')
const path = require('path')
const express = require('express')
const cors = require('cors')
const multer = require('multer')
const { v4: uuidv4 } = require('uuid')
const {
  openDb,
  rowToPair,
  rowToEntry,
  rowToTodo,
  rowToAnniversary,
} = require('./db')

const PORT = Number(process.env.PORT) || 8787
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads')
const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const INVITE_TTL_MS = 48 * 60 * 60 * 1000
const MAX_MEMBERS = 2
const CODE_RE = /^[A-Z0-9]{6}$/
const PRESET_IDS = ['warm', 'mint', 'night', 'plain']
const VALID_PRIORITIES = ['high', 'medium', 'low']
const VALID_STATUSES = ['open', 'done']

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
}

const db = openDb()
const app = express()

app.use(cors())
app.use(express.json({ limit: '2mb' }))
app.use('/uploads', express.static(UPLOAD_DIR))

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, UPLOAD_DIR)
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname || '') || '.jpg'
    cb(null, uuidv4() + ext.toLowerCase())
  },
})
const upload = multer({ storage, limits: { fileSize: 8 * 1024 * 1024 } })

function generateInviteCode() {
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += CHARSET[Math.floor(Math.random() * CHARSET.length)]
  }
  return code
}

function isInviteCodeFormat(code) {
  return typeof code === 'string' && CODE_RE.test(code)
}

function nowMs() {
  return Date.now()
}

function filePublicPath(filename) {
  return '/uploads/' + filename
}

/** Resolve openid from header or create for login */
function readOpenid(req) {
  const header = req.get('x-openid')
  if (header && String(header).trim()) return String(header).trim()
  return ''
}

function requireAuth(req, res, next) {
  const openid = readOpenid(req)
  if (!openid) {
    return res.status(401).json({ error: '缺少 x-openid，请先登录' })
  }
  req.openid = openid
  next()
}

function findPairByMember(openid) {
  const rows = db.prepare('SELECT * FROM pairs').all()
  for (const row of rows) {
    const members = JSON.parse(row.member_openids || '[]')
    if (Array.isArray(members) && members.indexOf(openid) >= 0) {
      return row
    }
  }
  return null
}

function getPairRow(id) {
  return db.prepare('SELECT * FROM pairs WHERE _id = ?').get(id) || null
}


function pickStr(body, key, fallback) {
  if (!body || body[key] == null) return fallback == null ? '' : fallback
  return String(body[key]).trim()
}

function narrativeFromBody(body, existing) {
  const ex = existing || {}
  return {
    timeAt: body && body.timeAt != null ? pickStr(body, 'timeAt') : (ex.time_at || ex.timeAt || ''),
    location: body && body.location != null ? pickStr(body, 'location') : (ex.location || ''),
    people: body && body.people != null ? pickStr(body, 'people') : (ex.people || ''),
    cause: body && body.cause != null ? pickStr(body, 'cause') : (ex.cause || ''),
    process: body && body.process != null ? pickStr(body, 'process') : (ex.process || ''),
    result: body && body.result != null ? pickStr(body, 'result') : (ex.result || ''),
  }
}

function assertMemberOfPair(openid, pairId) {
  const row = getPairRow(pairId)
  if (!row) return { ok: false, error: '配对不存在', status: 404 }
  const members = JSON.parse(row.member_openids || '[]')
  if (members.indexOf(openid) < 0) {
    return { ok: false, error: '无权访问该配对', status: 403 }
  }
  return { ok: true, row, members }
}

// --- Health ---
app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

// --- Auth ---
app.post('/api/auth/login', (req, res) => {
  let openid = readOpenid(req)
  if (!openid && req.body && req.body.openid) {
    openid = String(req.body.openid).trim()
  }
  if (!openid && req.body && req.body.debugOpenid) {
    openid = String(req.body.debugOpenid).trim()
  }
  if (!openid) {
    openid = 'local_' + uuidv4().replace(/-/g, '').slice(0, 16)
  }
  res.json({ openid })
})

// --- Pairs ---
app.get('/api/pairs/me', requireAuth, (req, res) => {
  const row = findPairByMember(req.openid)
  if (!row) return res.json(null)
  res.json(rowToPair(row))
})

/** Create or return a 1-member solo pair for local http use */
app.post('/api/pairs/ensure-solo', requireAuth, (req, res) => {
  const openid = req.openid
  const existing = findPairByMember(openid)
  if (existing) {
    return res.json(rowToPair(existing))
  }
  const now = nowMs()
  const id = uuidv4()
  db.prepare(
    `INSERT INTO pairs (_id, member_openids, invite_code, invite_expire_at, invite_active, background, created_at, updated_at)
     VALUES (?, ?, NULL, NULL, 0, ?, ?, ?)`
  ).run(
    id,
    JSON.stringify([openid]),
    JSON.stringify({ type: 'preset', presetId: 'plain' }),
    now,
    now
  )
  const row = getPairRow(id)
  res.json(rowToPair(row))
})


app.post('/api/pairs/invite', requireAuth, (req, res) => {
  const openid = req.openid
  const now = nowMs()
  const inviteCode = generateInviteCode()
  const inviteExpireAt = now + INVITE_TTL_MS

  const existing = findPairByMember(openid)
  if (existing) {
    const members = JSON.parse(existing.member_openids || '[]')
    if (members.length >= MAX_MEMBERS) {
      return res.status(400).json({ error: '配对已满员，无法再生成邀请码' })
    }
    db.prepare(
      `UPDATE pairs SET invite_code = ?, invite_expire_at = ?, invite_active = 1, updated_at = ? WHERE _id = ?`
    ).run(inviteCode, inviteExpireAt, now, existing._id)
    return res.json({
      pairId: existing._id,
      inviteCode,
      inviteExpireAt,
    })
  }

  const id = uuidv4()
  db.prepare(
    `INSERT INTO pairs (_id, member_openids, invite_code, invite_expire_at, invite_active, background, created_at, updated_at)
     VALUES (?, ?, ?, ?, 1, ?, ?, ?)`
  ).run(
    id,
    JSON.stringify([openid]),
    inviteCode,
    inviteExpireAt,
    JSON.stringify({ type: 'preset', presetId: 'plain' }),
    now,
    now
  )

  res.json({ pairId: id, inviteCode, inviteExpireAt })
})

app.post('/api/pairs/accept', requireAuth, (req, res) => {
  const openid = req.openid
  const raw = (req.body && req.body.inviteCode) || ''
  const inviteCode = String(raw).trim().toUpperCase()
  const now = nowMs()

  if (!isInviteCodeFormat(inviteCode)) {
    return res
      .status(400)
      .json({ error: '邀请码格式不正确，请输入 6 位大写字母或数字' })
  }

  const mine = findPairByMember(openid)
  if (mine) {
    if (mine.invite_code === inviteCode) {
      return res.json({ pairId: mine._id })
    }
    return res.status(400).json({ error: '你已在其他配对中，无法再加入' })
  }

  const found = db
    .prepare(
      `SELECT * FROM pairs WHERE invite_code = ? AND invite_active = 1 LIMIT 1`
    )
    .get(inviteCode)

  if (!found) {
    return res.status(400).json({ error: '邀请码无效或已失效' })
  }

  const members = JSON.parse(found.member_openids || '[]')
  if (members.indexOf(openid) >= 0) {
    return res.json({ pairId: found._id })
  }

  if (
    typeof found.invite_expire_at === 'number' &&
    found.invite_expire_at < now
  ) {
    db.prepare(
      `UPDATE pairs SET invite_active = 0, updated_at = ? WHERE _id = ?`
    ).run(now, found._id)
    return res.status(400).json({ error: '邀请码已过期，请让对方重新生成' })
  }

  if (members.length >= MAX_MEMBERS) {
    db.prepare(
      `UPDATE pairs SET invite_active = 0, updated_at = ? WHERE _id = ?`
    ).run(now, found._id)
    return res.status(400).json({ error: '该配对已满员（最多 2 人）' })
  }

  const newMembers = members.concat([openid])
  const full = newMembers.length >= MAX_MEMBERS
  db.prepare(
    `UPDATE pairs SET member_openids = ?, invite_active = ?, updated_at = ? WHERE _id = ?`
  ).run(JSON.stringify(newMembers), full ? 0 : 1, now, found._id)

  res.json({ pairId: found._id })
})

function handleBackgroundUpdate(req, res) {
  const pairId = req.params.id
  const check = assertMemberOfPair(req.openid, pairId)
  if (!check.ok) return res.status(check.status).json({ error: check.error })

  const now = nowMs()
  let background = null

  if (req.file) {
    const type = (req.body && req.body.type) || 'custom'
    if (type !== 'custom') {
      return res.status(400).json({ error: '背景类型无效' })
    }
    background = {
      type: 'custom',
      fileId: filePublicPath(req.file.filename),
    }
  } else {
    const type = req.body && req.body.type
    if (type === 'preset') {
      const presetId =
        PRESET_IDS.indexOf(req.body.presetId) >= 0 ? req.body.presetId : ''
      if (!presetId) {
        return res.status(400).json({ error: '请选择有效的预设主题' })
      }
      background = { type: 'preset', presetId }
    } else if (type === 'custom') {
      const fileId = (req.body && req.body.fileId) || ''
      if (!fileId) {
        return res.status(400).json({ error: '请选择自定义背景图' })
      }
      background = { type: 'custom', fileId }
    } else {
      return res.status(400).json({ error: '背景类型无效' })
    }
  }

  db.prepare(
    `UPDATE pairs SET background = ?, updated_at = ? WHERE _id = ?`
  ).run(JSON.stringify(background), now, pairId)

  res.json(background)
}

app.put(
  '/api/pairs/:id/background',
  requireAuth,
  upload.single('file'),
  handleBackgroundUpdate
)
// wx.uploadFile always POSTs
app.post(
  '/api/pairs/:id/background',
  requireAuth,
  upload.single('file'),
  handleBackgroundUpdate
)

// --- Entries ---
app.get('/api/entries', requireAuth, (req, res) => {
  const pairId = req.query.pairId
  if (!pairId) {
    return res.status(400).json({ error: '缺少 pairId' })
  }
  const check = assertMemberOfPair(req.openid, pairId)
  if (!check.ok) return res.status(check.status).json({ error: check.error })

  const rows = db
    .prepare(
      `SELECT * FROM entries WHERE pair_id = ? ORDER BY created_at DESC`
    )
    .all(pairId)
  res.json(rows.map(rowToEntry))
})

app.post('/api/entries', requireAuth, (req, res) => {
  const pairId = req.body && req.body.pairId
  if (!pairId) {
    return res.status(400).json({ error: '缺少 pairId' })
  }
  const check = assertMemberOfPair(req.openid, pairId)
  if (!check.ok) return res.status(check.status).json({ error: check.error })

  const now = nowMs()
  const id = uuidv4()
  const title = String((req.body && req.body.title) || '').trim()
  const nar = narrativeFromBody(req.body, null)
  let content = String((req.body && req.body.content) || '').trim()
  if (!content && nar.process) content = nar.process
  if (!nar.process && content) nar.process = content

  db.prepare(
    `INSERT INTO entries (_id, pair_id, author_openid, title, content, image_file_ids, time_at, location, people, cause, process, result, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, '[]', ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    pairId,
    req.openid,
    title,
    content,
    nar.timeAt,
    nar.location,
    nar.people,
    nar.cause,
    nar.process,
    nar.result,
    now,
    now
  )

  const row = db.prepare('SELECT * FROM entries WHERE _id = ?').get(id)
  res.json(rowToEntry(row))
})

app.get('/api/entries/:id', requireAuth, (req, res) => {
  const row = db
    .prepare('SELECT * FROM entries WHERE _id = ?')
    .get(req.params.id)
  if (!row) return res.status(404).json({ error: '见闻不存在' })
  const check = assertMemberOfPair(req.openid, row.pair_id)
  if (!check.ok) return res.status(check.status).json({ error: check.error })
  res.json(rowToEntry(row))
})

app.patch('/api/entries/:id', requireAuth, (req, res) => {
  const row = db
    .prepare('SELECT * FROM entries WHERE _id = ?')
    .get(req.params.id)
  if (!row) return res.status(404).json({ error: '见闻不存在' })
  const check = assertMemberOfPair(req.openid, row.pair_id)
  if (!check.ok) return res.status(check.status).json({ error: check.error })

  const now = nowMs()
  let title = row.title
  let content = row.content
  let imageFileIds = JSON.parse(row.image_file_ids || '[]')
  const nar = narrativeFromBody(req.body, row)

  if (req.body && req.body.title != null) {
    title = String(req.body.title).trim()
  }
  if (req.body && req.body.content != null) {
    content = String(req.body.content).trim()
  } else if (req.body && req.body.process != null) {
    content = nar.process
  }
  if (req.body && Array.isArray(req.body.imageFileIds)) {
    imageFileIds = req.body.imageFileIds.slice(0, 9)
  }

  db.prepare(
    `UPDATE entries SET title = ?, content = ?, image_file_ids = ?, time_at = ?, location = ?, people = ?, cause = ?, process = ?, result = ?, updated_at = ? WHERE _id = ?`
  ).run(
    title,
    content,
    JSON.stringify(imageFileIds),
    nar.timeAt,
    nar.location,
    nar.people,
    nar.cause,
    nar.process,
    nar.result,
    now,
    req.params.id
  )

  const updated = db
    .prepare('SELECT * FROM entries WHERE _id = ?')
    .get(req.params.id)
  res.json(rowToEntry(updated))
})

app.delete('/api/entries/:id', requireAuth, (req, res) => {
  const row = db
    .prepare('SELECT * FROM entries WHERE _id = ?')
    .get(req.params.id)
  if (!row) return res.status(404).json({ error: '见闻不存在' })
  const check = assertMemberOfPair(req.openid, row.pair_id)
  if (!check.ok) return res.status(check.status).json({ error: check.error })
  db.prepare('DELETE FROM entries WHERE _id = ?').run(req.params.id)
  res.json({ ok: true })
})

app.post(
  '/api/entries/:id/images',
  requireAuth,
  upload.single('file'),
  (req, res) => {
    const row = db
      .prepare('SELECT * FROM entries WHERE _id = ?')
      .get(req.params.id)
    if (!row) return res.status(404).json({ error: '见闻不存在' })
    const check = assertMemberOfPair(req.openid, row.pair_id)
    if (!check.ok) return res.status(check.status).json({ error: check.error })
    if (!req.file) {
      return res.status(400).json({ error: '缺少上传文件' })
    }

    const fileId = filePublicPath(req.file.filename)
    const now = nowMs()
    const ids = JSON.parse(row.image_file_ids || '[]')
    if (ids.length < 9) {
      ids.push(fileId)
      db.prepare(
        `UPDATE entries SET image_file_ids = ?, updated_at = ? WHERE _id = ?`
      ).run(JSON.stringify(ids), now, req.params.id)
    }

    res.json({ fileId, fileID: fileId })
  }
)

// --- Todos ---
app.get('/api/todos', requireAuth, (req, res) => {
  const pairId = req.query.pairId
  if (!pairId) {
    return res.status(400).json({ error: '缺少 pairId' })
  }
  const check = assertMemberOfPair(req.openid, pairId)
  if (!check.ok) return res.status(check.status).json({ error: check.error })

  const rows = db
    .prepare('SELECT * FROM todos WHERE pair_id = ?')
    .all(pairId)
  res.json(rows.map(rowToTodo))
})

app.get('/api/todos/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM todos WHERE _id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: '待办不存在' })
  const check = assertMemberOfPair(req.openid, row.pair_id)
  if (!check.ok) return res.status(check.status).json({ error: check.error })
  res.json(rowToTodo(row))
})

app.post('/api/todos', requireAuth, (req, res) => {
  const pairId = req.body && req.body.pairId
  if (!pairId) {
    return res.status(400).json({ error: '缺少 pairId' })
  }
  const check = assertMemberOfPair(req.openid, pairId)
  if (!check.ok) return res.status(check.status).json({ error: check.error })

  const title = String((req.body && req.body.title) || '').trim()
  if (!title) {
    return res.status(400).json({ error: '请填写待办标题' })
  }

  let priority = (req.body && req.body.priority) || 'medium'
  if (VALID_PRIORITIES.indexOf(priority) < 0) priority = 'medium'

  let dueAt =
    req.body && req.body.dueAt != null && req.body.dueAt !== ''
      ? Number(req.body.dueAt)
      : null
  if (dueAt != null && Number.isNaN(dueAt)) dueAt = null

  const now = nowMs()
  const id = uuidv4()
  const status =
    req.body && VALID_STATUSES.indexOf(req.body.status) >= 0
      ? req.body.status
      : 'open'

  const nar = narrativeFromBody(req.body, null)
  const approxTime =
    pickStr(req.body, 'approxTime') || pickStr(req.body, 'timeNote') || ''

  db.prepare(
    `INSERT INTO todos (_id, pair_id, title, priority, status, due_at, creator_openid, updated_by_openid, time_at, location, people, cause, process, result, approx_time, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    pairId,
    title,
    priority,
    status,
    dueAt,
    req.openid,
    req.openid,
    nar.timeAt,
    nar.location,
    nar.people,
    nar.cause,
    nar.process,
    nar.result,
    approxTime,
    now,
    now
  )

  const created = db.prepare('SELECT * FROM todos WHERE _id = ?').get(id)
  res.json(rowToTodo(created))
})

app.put('/api/todos/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM todos WHERE _id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: '待办不存在' })
  const check = assertMemberOfPair(req.openid, row.pair_id)
  if (!check.ok) return res.status(check.status).json({ error: check.error })

  const title = String((req.body && req.body.title) || '').trim()
  if (!title) {
    return res.status(400).json({ error: '请填写待办标题' })
  }

  let priority = (req.body && req.body.priority) || 'medium'
  if (VALID_PRIORITIES.indexOf(priority) < 0) priority = 'medium'

  let dueAt =
    req.body && req.body.dueAt != null && req.body.dueAt !== ''
      ? Number(req.body.dueAt)
      : null
  if (dueAt != null && Number.isNaN(dueAt)) dueAt = null

  let status = row.status
  if (req.body && VALID_STATUSES.indexOf(req.body.status) >= 0) {
    status = req.body.status
  }

  const nar = narrativeFromBody(req.body, row)
  let approxTime = row.approx_time || ''
  if (req.body) {
    if (req.body.approxTime != null) approxTime = pickStr(req.body, 'approxTime')
    else if (req.body.timeNote != null) approxTime = pickStr(req.body, 'timeNote')
  }

  const now = nowMs()
  db.prepare(
    `UPDATE todos SET title = ?, priority = ?, status = ?, due_at = ?, updated_by_openid = ?, time_at = ?, location = ?, people = ?, cause = ?, process = ?, result = ?, approx_time = ?, updated_at = ? WHERE _id = ?`
  ).run(
    title,
    priority,
    status,
    dueAt,
    req.openid,
    nar.timeAt,
    nar.location,
    nar.people,
    nar.cause,
    nar.process,
    nar.result,
    approxTime,
    now,
    req.params.id
  )

  const updated = db
    .prepare('SELECT * FROM todos WHERE _id = ?')
    .get(req.params.id)
  res.json(rowToTodo(updated))
})

app.patch('/api/todos/:id/status', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM todos WHERE _id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: '待办不存在' })
  const check = assertMemberOfPair(req.openid, row.pair_id)
  if (!check.ok) return res.status(check.status).json({ error: check.error })

  const status = req.body && req.body.status
  if (VALID_STATUSES.indexOf(status) < 0) {
    return res.status(400).json({ error: '无效的状态' })
  }

  const now = nowMs()
  db.prepare(
    `UPDATE todos SET status = ?, updated_by_openid = ?, updated_at = ? WHERE _id = ?`
  ).run(status, req.openid, now, req.params.id)

  res.json({ ok: true })
})

app.delete('/api/todos/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM todos WHERE _id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: '待办不存在' })
  const check = assertMemberOfPair(req.openid, row.pair_id)
  if (!check.ok) return res.status(check.status).json({ error: check.error })

  db.prepare('DELETE FROM todos WHERE _id = ?').run(req.params.id)
  res.json({ ok: true })
})

// --- Anniversaries ---
app.get('/api/anniversaries', requireAuth, (req, res) => {
  const pairId = req.query.pairId
  if (!pairId) {
    return res.status(400).json({ error: '缺少 pairId' })
  }
  const check = assertMemberOfPair(req.openid, pairId)
  if (!check.ok) return res.status(check.status).json({ error: check.error })

  const rows = db
    .prepare('SELECT * FROM anniversaries WHERE pair_id = ?')
    .all(pairId)
  res.json(rows.map(rowToAnniversary))
})

app.get('/api/anniversaries/:id', requireAuth, (req, res) => {
  const row = db
    .prepare('SELECT * FROM anniversaries WHERE _id = ?')
    .get(req.params.id)
  if (!row) return res.status(404).json({ error: '纪念日不存在' })
  const check = assertMemberOfPair(req.openid, row.pair_id)
  if (!check.ok) return res.status(check.status).json({ error: check.error })
  res.json(rowToAnniversary(row))
})

app.post('/api/anniversaries', requireAuth, (req, res) => {
  const pairId = req.body && req.body.pairId
  if (!pairId) {
    return res.status(400).json({ error: '缺少 pairId' })
  }
  const check = assertMemberOfPair(req.openid, pairId)
  if (!check.ok) return res.status(check.status).json({ error: check.error })

  const title = String((req.body && req.body.title) || '').trim()
  if (!title) {
    return res.status(400).json({ error: '请填写纪念日标题' })
  }
  const date = String((req.body && req.body.date) || '').trim()
  if (!date) {
    return res.status(400).json({ error: '请选择日期' })
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) && !/^\d{1,2}-\d{1,2}$/.test(date)) {
    return res.status(400).json({ error: '日期格式无效' })
  }
  const repeatYearly = !!(req.body && req.body.repeatYearly)
  const now = nowMs()
  const id = uuidv4()

  const nar = narrativeFromBody(req.body, null)

  db.prepare(
    `INSERT INTO anniversaries (_id, pair_id, title, date, repeat_yearly, location, people, cause, process, result, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    pairId,
    title,
    date,
    repeatYearly ? 1 : 0,
    nar.location,
    nar.people,
    nar.cause,
    nar.process,
    nar.result,
    now,
    now
  )

  const created = db.prepare('SELECT * FROM anniversaries WHERE _id = ?').get(id)
  res.json(rowToAnniversary(created))
})

app.put('/api/anniversaries/:id', requireAuth, (req, res) => {
  const row = db
    .prepare('SELECT * FROM anniversaries WHERE _id = ?')
    .get(req.params.id)
  if (!row) return res.status(404).json({ error: '纪念日不存在' })
  const check = assertMemberOfPair(req.openid, row.pair_id)
  if (!check.ok) return res.status(check.status).json({ error: check.error })

  const title = String((req.body && req.body.title) || '').trim()
  if (!title) {
    return res.status(400).json({ error: '请填写纪念日标题' })
  }
  const date = String((req.body && req.body.date) || '').trim()
  if (!date) {
    return res.status(400).json({ error: '请选择日期' })
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) && !/^\d{1,2}-\d{1,2}$/.test(date)) {
    return res.status(400).json({ error: '日期格式无效' })
  }
  const repeatYearly = !!(req.body && req.body.repeatYearly)
  const now = nowMs()
  const nar = narrativeFromBody(req.body, row)

  db.prepare(
    `UPDATE anniversaries SET title = ?, date = ?, repeat_yearly = ?, location = ?, people = ?, cause = ?, process = ?, result = ?, updated_at = ? WHERE _id = ?`
  ).run(
    title,
    date,
    repeatYearly ? 1 : 0,
    nar.location,
    nar.people,
    nar.cause,
    nar.process,
    nar.result,
    now,
    req.params.id
  )

  const updated = db
    .prepare('SELECT * FROM anniversaries WHERE _id = ?')
    .get(req.params.id)
  res.json(rowToAnniversary(updated))
})

app.delete('/api/anniversaries/:id', requireAuth, (req, res) => {
  const row = db
    .prepare('SELECT * FROM anniversaries WHERE _id = ?')
    .get(req.params.id)
  if (!row) return res.status(404).json({ error: '纪念日不存在' })
  const check = assertMemberOfPair(req.openid, row.pair_id)
  if (!check.ok) return res.status(check.status).json({ error: check.error })

  db.prepare('DELETE FROM anniversaries WHERE _id = ?').run(req.params.id)
  res.json({ ok: true })
})

// Error handler for multer / unexpected
app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: err.message || '服务器错误' })
})

app.listen(PORT, '0.0.0.0', () => {
  console.log('dual-journal server listening on http://127.0.0.1:' + PORT)
})
