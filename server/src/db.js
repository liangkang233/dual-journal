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
}

function parseJson(text, fallback) {
  if (text == null || text === '') return fallback
  try {
    return JSON.parse(text)
  } catch (e) {
    return fallback
  }
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
  return {
    _id: row._id,
    pairId: row.pair_id,
    authorOpenid: row.author_openid,
    title: row.title || '',
    content: row.content || '',
    imageFileIds: parseJson(row.image_file_ids, []),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function rowToTodo(row) {
  if (!row) return null
  return {
    _id: row._id,
    pairId: row.pair_id,
    title: row.title,
    priority: row.priority || 'medium',
    status: row.status || 'open',
    dueAt: row.due_at == null ? null : row.due_at,
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
