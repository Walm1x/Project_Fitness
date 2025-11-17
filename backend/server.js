// backend/server.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const { db, all, get, run } = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

const INIT_SQL_PATH = path.join(__dirname, 'init_db.sql');
const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';
const PORT = process.env.PORT || 3000;

// --- Initialize DB from SQL file if essential tables are missing ---
function ensureInit() {
  try {
    // check if users table exists
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
    if (!row) {
      console.log('Инициализация БД из init_db.sql ...');
      const sql = fs.readFileSync(INIT_SQL_PATH, 'utf8');
      db.exec(sql);
      console.log('Инициализация БД завершена.');
    } else {
      // optionally ensure time_slots populated
      const countSlots = db.prepare('SELECT COUNT(*) as c FROM time_slots').get().c;
      if(countSlots === 0){
        const sql = fs.readFileSync(INIT_SQL_PATH, 'utf8');
        db.exec(sql);
      }
    }
  } catch (err) {
    console.error('Ошибка инициализации БД:', err);
    process.exit(1);
  }
}
ensureInit();

// --- Helpers ---
function generateToken(user) {
  return jwt.sign({ id: user.id, role: user.role, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '8h' });
}
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if(!auth) return res.status(401).json({ error: 'No authorization header' });
  const parts = auth.split(' ');
  if(parts.length !== 2) return res.status(401).json({ error: 'Invalid authorization header' });
  const token = parts[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch(err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
function daysDiff(aDateStr, bDateStr) {
  const a = new Date(aDateStr);
  const b = new Date(bDateStr);
  const diff = Math.ceil((a - b) / (24*60*60*1000));
  return diff;
}
function formatDate(d) {
  return d.toISOString().slice(0,10);
}

// --- AUTH ---
app.post('/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if(!name || !email || !password) return res.status(400).json({ error: 'name,email,password required' });

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if(existing) return res.status(400).json({ error: 'Пользователь с таким email уже существует' });

    const hash = await bcrypt.hash(password, 10);
    const info = db.prepare('INSERT INTO users (name,email,password,role) VALUES (?,?,?,?)').run(name, email, hash, 'client');

    const user = { id: info.lastInsertRowid, name, email, role: 'client' };
    const token = generateToken(user);
    res.json({ message: 'Регистрация успешна', token, user });
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if(!email || !password) return res.status(400).json({ error: 'email,password required' });

    const row = db.prepare('SELECT id,name,email,password,role FROM users WHERE email = ?').get(email);
    if(!row) return res.status(400).json({ error: 'Неверный email или пароль' });

    const ok = await bcrypt.compare(password, row.password);
    if(!ok) return res.status(400).json({ error: 'Неверный email или пароль' });

    const user = { id: row.id, name: row.name, email: row.email, role: row.role };
    const token = generateToken(user);
    res.json({ message: 'Вход успешен', token, user });
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Admin login endpoint (expects admin user already created with role='admin')
app.post('/auth/admin', async (req, res) => {
  try {
    const { login, password } = req.body;
    if(!login || !password) return res.status(400).json({ error: 'login,password required' });

    const row = db.prepare('SELECT id,name,email,password,role FROM users WHERE email = ? AND role = ?').get(login, 'admin');
    if(!row) return res.status(400).json({ error: 'Администратор не найден' });

    const ok = await bcrypt.compare(password, row.password);
    if(!ok) return res.status(400).json({ error: 'Неверный пароль' });

    const user = { id: row.id, name: row.name, email: row.email, role: row.role };
    const token = generateToken(user);
    res.json({ message: 'Вход админа успешен', token, user });
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// --- UTIL: get trainers/zones/time_slots ---
app.get('/trainers', (req,res) => {
  try {
    const rows = all('SELECT id,name,specialty FROM trainers ORDER BY id');
    res.json(rows);
  } catch(err){ res.status(500).json({ error: err.message }); }
});
app.get('/zones', (req,res) => {
  try {
    const rows = all('SELECT id,name,type FROM zones ORDER BY id');
    res.json(rows);
  } catch(err){ res.status(500).json({ error: err.message }); }
});
app.get('/time_slots', (req,res) => {
  try {
    const rows = all('SELECT id,time_slot FROM time_slots ORDER BY id');
    res.json(rows);
  } catch(err){ res.status(500).json({ error: err.message }); }
});

// --- BOOKINGS: add with conflict check and alternatives ---
app.post('/bookings/add', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    let { trainer_id, zone_id, date, start_time, duration_minutes, type } = req.body;
    trainer_id = Number(trainer_id);
    zone_id = Number(zone_id);
    duration_minutes = Number(duration_minutes);

    if(!trainer_id || !zone_id || !date || !start_time || !duration_minutes) {
      return res.status(400).json({ error: 'trainer_id, zone_id, date, start_time, duration_minutes required' });
    }

    // Check date window: not past, not more than 14 days ahead
    const today = new Date(); today.setHours(0,0,0,0);
    const target = new Date(date); target.setHours(0,0,0,0);
    const diff = (target - today) / (24*60*60*1000);
    if(diff < 0) return res.status(400).json({ error: 'Нельзя бронировать на прошедшую дату' });
    if(diff > 14) return res.status(400).json({ error: 'Бронирование принимается не ранее, чем за 2 недели' });

    // Conflict: same date + start_time, and (trainer_id OR zone_id)
    const conflict = db.prepare(
      `SELECT b.id FROM bookings b
       WHERE b.date = ? AND b.start_time = ? AND (b.trainer_id = ? OR b.zone_id = ?)`
    ).get(date, start_time, trainer_id, zone_id);

    if(!conflict) {
      const info = db.prepare(
        `INSERT INTO bookings (user_id, trainer_id, zone_id, date, start_time, duration_minutes, type)
         VALUES (?,?,?,?,?,?,?)`
      ).run(userId, trainer_id, zone_id, date, start_time, duration_minutes, type || 'personal');

      const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(info.lastInsertRowid);
      return res.json({ message: 'Бронирование подтверждено', booking });
    }

    // Conflict ---> prepare alternatives
    const alternatives = { trainer_next_free: null, alternative_zone_same_time: null };

    // get ordered time slots
    const slots = all('SELECT time_slot FROM time_slots ORDER BY id').map(r => r.time_slot);

    // find next free slot for trainer within next 7 days (starting from requested date)
    for(let d = 0; d <= 7 && !alternatives.trainer_next_free; d++){
      const dt = new Date(date);
      dt.setDate(dt.getDate() + d);
      const ds = formatDate(dt);
      for(const s of slots){
        // skip original (d=0 and same slot) to find *next* free
        if(d === 0 && s === start_time) continue;
        const q = db.prepare('SELECT 1 FROM bookings WHERE date = ? AND start_time = ? AND trainer_id = ?').get(ds, s, trainer_id);
        if(!q) {
          alternatives.trainer_next_free = { date: ds, start_time: s };
          break;
        }
      }
    }

    // find alternative zone free at same date/time
    const zones = all('SELECT id,name FROM zones ORDER BY id');
    for(const z of zones){
      if(z.id === zone_id) continue;
      const qz = db.prepare('SELECT 1 FROM bookings WHERE date = ? AND start_time = ? AND zone_id = ?').get(date, start_time, z.id);
      if(!qz) {
        alternatives.alternative_zone_same_time = { zone_id: z.id, zone_name: z.name };
        break;
      }
    }

    return res.status(409).json({ error: 'Время занято', alternatives });

  } catch(err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET all bookings (protected)
app.get('/bookings/all', authMiddleware, (req, res) => {
  try {
    const rows = all(
      `SELECT b.id, u.name AS client, t.name AS trainer, z.name AS zone, b.date, b.start_time, b.duration_minutes, b.type
       FROM bookings b
       JOIN users u ON b.user_id = u.id
       JOIN trainers t ON b.trainer_id = t.id
       JOIN zones z ON b.zone_id = z.id
       ORDER BY b.date, b.start_time`
    );
    res.json(rows);
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// REPORT: bookings for period (protected)
app.get('/reports/bookings', authMiddleware, (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    if(!start_date || !end_date) return res.status(400).json({ error: 'start_date,end_date required' });

    const rows = all(
      `SELECT b.id, u.name AS client, t.name AS trainer, z.name AS zone, b.date, b.start_time, b.duration_minutes, b.type
       FROM bookings b
       JOIN users u ON b.user_id = u.id
       JOIN trainers t ON b.trainer_id = t.id
       JOIN zones z ON b.zone_id = z.id
       WHERE b.date BETWEEN ? AND ?
       ORDER BY b.date, b.start_time`,
      [start_date, end_date]
    );
    res.json(rows);
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// AVAILABILITY: return free pairings (time_slot, zone, trainer) for given date (protected)
app.get('/availability', authMiddleware, (req, res) => {
  try {
    const { date } = req.query;
    if(!date) return res.status(400).json({ error: 'date required' });

    const slots = all('SELECT time_slot FROM time_slots ORDER BY id').map(r => r.time_slot);
    const zones = all('SELECT id,name FROM zones ORDER BY id');
    const trainers = all('SELECT id,name FROM trainers ORDER BY id');

    const out = [];
    for(const s of slots){
      for(const z of zones){
        for(const t of trainers){
          const q = db.prepare('SELECT 1 FROM bookings WHERE date = ? AND start_time = ? AND (zone_id = ? OR trainer_id = ?)').get(date, s, z.id, t.id);
          if(!q){
            out.push({
              time_slot: s,
              zone_id: z.id,
              zone_name: z.name,
              trainer_id: t.id,
              trainer_name: t.name
            });
          }
        }
      }
    }
    res.json(out);
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// --- Start server ---
app.listen(PORT, () => console.log(`Server (SQLite) listening on port ${PORT}`));
