const fs = require('fs')
const path = require('path')
const Database = require('better-sqlite3')

const DATA_DIR = path.join(__dirname, '..', 'data')
const DB_PATH = path.join(DATA_DIR, 'dual-journal.sqlite')

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
}

/**
 * @returns {import('better-sqlite3').Database}
 */
function openDb() {
  ensureDataDir()
  const db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  migrate(db)
  return db
}

function tableColumns(db, table) {
  return db.prepare('PRAGMA table_info(' + table + ')').all().map((c) => c.name)
}

function addColumnIfMissing(db, table, column, typeSql) {
  const cols = tableColumns(db, table)
  if (cols.indexOf(column) < 0) {
    db.exec('ALTER TABLE ' + table + ' ADD COLUMN ' + column + ' ' + typeSql)
  }
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS pairs (
      _id TEXT PRIMARY KEY,
      member_openids TEXT NOT NULL DEFAULT '[]',
      invite_code TEXT,
      invite_expire_at INTEGER,
      invite_active INTEGER NOT NULL DEFAULT 0,
      background TEXT NOT NULL DEFAULT '{"type":"preset","presetId":"plain"}',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_pairs_invite_code ON pairs(invite_code);

    CREATE TABLE IF NOT EXISTS entries (
      _id TEXT PRIMARY KEY,
      pair_id TEXT NOT NULL,
      author_openid TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      image_file_ids TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (pair_id) REFERENCES pairs(_id)
    );

    CREATE INDEX IF NOT EXISTS idx_entries_pair ON entries(pair_id);

    CREATE TABLE IF NOT EXISTS todos (
      _id TEXT PRIMARY KEY,
      pair_id TEXT NOT NULL,
      title TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'medium',
      status TEXT NOT NULL DEFAULT 'open',
      due_at INTEGER,
      creator_openid TEXT NOT NULL,
      updated_by_openid TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (pair_id) REFERENCES pairs(_id)
    );

    CREATE INDEX IF NOT EXISTS idx_todos_pair ON todos(pair_id);

    CREATE TABLE IF NOT EXISTS anniversaries (
      _id TEXT PRIMARY KEY,
      pair_id TEXT NOT NULL,
      title TEXT NOT NULL,
      date TEXT NOT NULL,
      repeat_yearly INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (pair_id) REFERENCES pairs(_id)
    );

    CREATE INDEX IF NOT EXISTS idx_anniversaries_pair ON anniversaries(pair_id);

    CREATE TABLE IF NOT EXISTS subscriptions (
      _id TEXT PRIMARY KEY,
      openid TEXT,
      pair_id TEXT,
      template_id TEXT,
      created_at INTEGER NOT NULL
    );
  `)

  // Shared narrative fields: 时间/地点/人物/起因/经过/结果
  const narrativeCols = [
    ['time_at', "TEXT NOT NULL DEFAULT ''"],
    ['location', "TEXT NOT NULL DEFAULT ''"],
    ['people', "TEXT NOT NULL DEFAULT ''"],
    ['cause', "TEXT NOT NULL DEFAULT ''"],
    ['process', "TEXT NOT NULL DEFAULT ''"],
    ['result', "TEXT NOT NULL DEFAULT ''"],
  ]
  narrativeCols.forEach(([col, typ]) => {
    addColumnIfMissing(db, 'entries', col, typ)
    addColumnIfMissing(db, 'todos', col, typ)
    addColumnIfMissing(db, 'anniversaries', col, typ)
  })
  // Todos: approximate time note (大概时间)
  addColumnIfMissing(db, 'todos', 'approx_time', "TEXT NOT NULL DEFAULT ''")
}

function parseJson(text, fallback) {
  if (text == null || text === '') return fallback
  try {
    return JSON.parse(text)
  } catch (e) {
    return fallback
  }
}

function strField(row, key, fallback) {
  const v = row[key]
  if (v == null) return fallback == null ? '' : fallback
  return String(v)
}

function rowToPair(row) {
  if (!row) return null
  return {
    _id: row._id,
    memberOpenids: parseJson(row.member_openids, []),
    inviteCode: row.invite_code || '',
    inviteExpireAt: row.invite_expire_at,
    inviteActive: !!row.invite_active,
    background: parseJson(row.background, { type: 'preset', presetId: 'plain' }),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function rowToEntry(row) {
  if (!row) return null
  const process = strField(row, 'process', '')
  const content = row.content || ''
  return {
    _id: row._id,
    pairId: row.pair_id,
    authorOpenid: row.author_openid,
    title: row.title || '',
    content: content,
    timeAt: strField(row, 'time_at', ''),
    location: strField(row, 'location', ''),
    people: strField(row, 'people', ''),
    cause: strField(row, 'cause', ''),
    process: process || content,
    result: strField(row, 'result', ''),
    imageFileIds: parseJson(row.image_file_ids, []),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function rowToTodo(row) {
  if (!row) return null
  const process = strField(row, 'process', '')
  return {
    _id: row._id,
    pairId: row.pair_id,
    title: row.title,
    priority: row.priority || 'medium',
    status: row.status || 'open',
    dueAt: row.due_at == null ? null : row.due_at,
    approxTime: strField(row, 'approx_time', ''),
    timeAt: strField(row, 'time_at', ''),
    location: strField(row, 'location', ''),
    people: strField(row, 'people', ''),
    cause: strField(row, 'cause', ''),
    process: process,
    result: strField(row, 'result', ''),
    creatorOpenid: row.creator_openid,
    updatedByOpenid: row.updated_by_openid || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function rowToAnniversary(row) {
  if (!row) return null
  return {
    _id: row._id,
    pairId: row.pair_id,
    title: row.title,
    date: row.date,
    repeatYearly: !!row.repeat_yearly,
    location: strField(row, 'location', ''),
    people: strField(row, 'people', ''),
    cause: strField(row, 'cause', ''),
    process: strField(row, 'process', ''),
    result: strField(row, 'result', ''),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

module.exports = {
  openDb,
  DB_PATH,
  DATA_DIR,
  rowToPair,
  rowToEntry,
  rowToTodo,
  rowToAnniversary,
}
