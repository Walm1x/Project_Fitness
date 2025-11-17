// backend/db.js
const path = require('path');
const Database = require('better-sqlite3');

const DB_FILE = process.env.DB_FILE || path.join(__dirname, '..', 'fitness.db');

const db = new Database(DB_FILE);

// Утилита для выполнения подготовленных запросов с возвратом rows
function all(sql, params = []) {
  const stmt = db.prepare(sql);
  return stmt.all(...params);
}
function get(sql, params = []) {
  const stmt = db.prepare(sql);
  return stmt.get(...params);
}
function run(sql, params = []) {
  const stmt = db.prepare(sql);
  return stmt.run(...params);
}

module.exports = { db, all, get, run };
