const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const mysql = require('mysql2');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());

const JWT_SECRET = "supersecret";

// Простое подключение к MySQL без пула
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root', 
  password: '2234',
  database: 'fitness_db'
});

// Подключаемся к БД
db.connect((err) => {
  if (err) {
    console.log('❌ Ошибка подключения к MySQL:', err.message);
    console.log('📌 Убедитесь что:');
    console.log('   1. MySQL сервер запущен');
    console.log('   2. База данных fitness_db существует');
    console.log('   3. Пароль правильный (2234)');
    return;
  }
  console.log('✅ Подключение к MySQL установлено');
  initializeDatabase();
});

// Функция для выполнения SQL запросов
function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
}

// Инициализация базы данных
async function initializeDatabase() {
  try {
    console.log('🔄 Инициализация базы данных...');
    
    // Создаем таблицы
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role ENUM('client','admin') DEFAULT 'client'
      )
    `);
    
    await query(`
      CREATE TABLE IF NOT EXISTS trainers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        specialty VARCHAR(255)
      )
    `);
    
    await query(`
      CREATE TABLE IF NOT EXISTS zones (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255),
        type VARCHAR(50)
      )
    `);
    
    await query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        trainer_id INT,
        zone_id INT,
        date DATE,
        start_time TIME,
        duration_minutes INT,
        type VARCHAR(50)
      )
    `);
    
    // Добавляем тестовые данные
    const users = await query("SELECT COUNT(*) as count FROM users");
    if (users[0].count === 0) {
      console.log('📝 Добавляем тестовые данные...');
      
      // Тестовые пользователи - ФИКСИРУЕМ АДМИНА
      await query(`
        INSERT INTO users (name, email, password, role) VALUES 
        ('Администратор', 'admin@example.com', ?, 'admin'),
        ('Иван Петров', 'ivan@example.com', ?, 'client')
      `, [
        await bcrypt.hash('admin123', 10),
        await bcrypt.hash('password123', 10)
      ]);
      
      // Тренеры
      await query(`
        INSERT INTO trainers (name, specialty) VALUES 
        ('Иванова', 'personal'),
        ('Сидоров', 'pilates'), 
        ('Петрова', 'yoga')
      `);
      
      // Зоны
      await query(`
        INSERT INTO zones (name, type) VALUES 
        ('Кардио зона', 'cardio'),
        ('Силовая зона', 'strength'),
        ('Зал групповых занятий', 'group'),
        ('Премиум зал', 'premium'),
        ('Студия йоги', 'yoga')
      `);
      
      console.log('✅ Тестовые данные добавлены');
    }
    
    console.log('✅ База данных готова к работе');
    console.log('👤 Тестовые аккаунты:');
    console.log('   Админ: admin@example.com / admin123');
    console.log('   Клиент: ivan@example.com / password123');
    
  } catch (err) {
    console.log('❌ Ошибка инициализации БД:', err.message);
  }
}

// ====== Маршруты ======

// Статические файлы
app.use(express.static(path.join(__dirname, '../frontend')));

// Главная страница
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/register.html'));
});

// Регистрация
app.post('/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    // Проверяем есть ли пользователь
    const users = await query("SELECT id FROM users WHERE email = ?", [email]);
    if (users.length > 0) {
      return res.status(400).json({ error: "Email уже существует" });
    }
    
    // Хешируем пароль
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Создаем пользователя
    await query(
      "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
      [name, email, hashedPassword]
    );
    
    res.json({ message: "Регистрация успешна!" });
    
  } catch (err) {
    console.log('Ошибка регистрации:', err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Вход
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Ищем пользователя
    const users = await query("SELECT * FROM users WHERE email = ?", [email]);
    if (users.length === 0) {
      return res.status(400).json({ error: "Неверный email или пароль" });
    }
    
    const user = users[0];
    
    // Проверяем пароль
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: "Неверный email или пароль" });
    }
    
    // Создаем токен
    const token = jwt.sign(
      { id: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: "8h" }
    );
    
    res.json({ 
      message: "Вход успешен!", 
      token, 
      user_id: user.id 
    });
    
  } catch (err) {
    console.log('Ошибка входа:', err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Вход администратора - ФИКСИРУЕМ
app.post('/auth/admin', async (req, res) => {
  try {
    const { login, password } = req.body;
    
    console.log('Попытка входа администратора:', login);
    
    // Ищем администратора по email
    const users = await query("SELECT * FROM users WHERE email = ?", [login]);
    
    if (users.length === 0) {
      console.log('Администратор не найден:', login);
      return res.status(400).json({ error: "Администратор не найден" });
    }
    
    const user = users[0];
    console.log('Найден пользователь:', user);
    
    // Проверяем что пользователь - администратор
    if (user.role !== 'admin') {
      console.log('Пользователь не администратор:', user.role);
      return res.status(400).json({ error: "Недостаточно прав" });
    }
    
    // Проверяем пароль
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      console.log('Неверный пароль');
      return res.status(400).json({ error: "Неверный пароль" });
    }
    
    // Создаем токен
    const token = jwt.sign(
      { id: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: "8h" }
    );
    
    console.log('Вход администратора успешен');
    res.json({ 
      message: "Вход администратора успешен!", 
      token,
      user_id: user.id 
    });
    
  } catch (err) {
    console.log('Ошибка входа администратора:', err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Получить тренеров
app.get('/trainers', async (req, res) => {
  try {
    const trainers = await query("SELECT * FROM trainers");
    res.json(trainers);
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Получить зоны
app.get('/zones', async (req, res) => {
  try {
    const zones = await query("SELECT * FROM zones");
    res.json(zones);
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Создать бронирование
app.post('/bookings/add', async (req, res) => {
  try {
    const { user_id, trainer_id, zone_id, date, start_time, duration, type } = req.body;
    
    // Проверяем существование тренера и зоны
    const trainers = await query("SELECT id FROM trainers WHERE id = ?", [trainer_id]);
    const zones = await query("SELECT id FROM zones WHERE id = ?", [zone_id]);
    
    if (trainers.length === 0) {
      return res.status(400).json({ error: "Тренер не найден" });
    }
    if (zones.length === 0) {
      return res.status(400).json({ error: "Зона не найдена" });
    }
    
    // Создаем бронирование
    await query(
      `INSERT INTO bookings (user_id, trainer_id, zone_id, date, start_time, duration_minutes, type) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [user_id, trainer_id, zone_id, date, start_time, duration * 60, type]
    );
    
    res.json({ message: "Бронирование создано успешно!" });
    
  } catch (err) {
    console.log('Ошибка бронирования:', err);
    res.status(500).json({ error: "Ошибка при создании бронирования" });
  }
});

// Получить все бронирования (для отчетов)
app.get('/bookings', async (req, res) => {
  try {
    const bookings = await query(`
      SELECT b.*, u.name as user_name, t.name as trainer_name, z.name as zone_name
      FROM bookings b
      LEFT JOIN users u ON b.user_id = u.id
      LEFT JOIN trainers t ON b.trainer_id = t.id
      LEFT JOIN zones z ON b.zone_id = z.id
      ORDER BY b.date, b.start_time
    `);
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Отладочный маршрут для проверки данных
app.get('/debug', async (req, res) => {
  try {
    const users = await query("SELECT id, name, email, role FROM users");
    const trainers = await query("SELECT * FROM trainers");
    const zones = await query("SELECT * FROM zones");
    const bookings = await query("SELECT * FROM bookings");
    
    res.json({
      users,
      trainers,
      zones, 
      bookings
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Запуск сервера
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
  console.log(`🔧 Отладочная информация: http://localhost:${PORT}/debug`);
  console.log('');
  console.log('🎯 ДЛЯ ТЕСТИРОВАНИЯ:');
  console.log('   👤 Обычный вход: ivan@example.com / password123');
  console.log('   🔐 Админ вход:   admin@example.com / admin123');
});
// =====================================================
// ===== ADDED FOR TASK 2 ===============================
// ===== Проверка занятости + альтернативы ==============
// =====================================================
app.post('/bookings/check', async (req, res) => {
  try {
    const { date, start_time, trainer_id, zone_id } = req.body;

    // Проверяем, есть ли конфликт
    const conflicts = await query(
      `SELECT * FROM bookings
       WHERE date = ?
       AND start_time = ?
       AND (trainer_id = ? OR zone_id = ?)`,
      [date, start_time, trainer_id, zone_id]
    );

    // Если свободно — сразу сообщаем
    if (conflicts.length === 0) {
      return res.json({
        available: true,
        message: "Выбранное время свободно"
      });
    }

    // ---- Альтернативное время ----
    const alternativeTimes = await query(`
      SELECT time_slot
      FROM time_slots
      WHERE time_slot NOT IN (
        SELECT start_time FROM bookings WHERE date = ?
      )
      ORDER BY time_slot
      LIMIT 5
    `, [date]);

    // ---- Альтернативные зоны ----
    const alternativeZones = await query(`
      SELECT * FROM zones
      WHERE id NOT IN (
        SELECT zone_id FROM bookings
        WHERE date = ? AND start_time = ?
      )
    `, [date, start_time]);

    res.json({
      available: false,
      message: "Выбранное время занято",
      alternatives: {
        times: alternativeTimes,
        zones: alternativeZones
      }
    });

  } catch (err) {
    console.log('Ошибка проверки доступности:', err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});


// =====================================================
// ===== ADDED FOR TASK 4 ===============================
// ===== Отчет по доступности на дату ===================
// =====================================================
app.get('/availability', async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ error: "Не указана дата" });
    }

    // Свободные тренеры
    const freeTrainers = await query(`
      SELECT * FROM trainers
      WHERE id NOT IN (
        SELECT DISTINCT trainer_id
        FROM bookings
        WHERE date = ?
      )
    `, [date]);

    // Свободные зоны
    const freeZones = await query(`
      SELECT * FROM zones
      WHERE id NOT IN (
        SELECT DISTINCT zone_id
        FROM bookings
        WHERE date = ?
      )
    `, [date]);

    // Свободные временные слоты
    const freeTimeSlots = await query(`
      SELECT time_slot
      FROM time_slots
      WHERE time_slot NOT IN (
        SELECT start_time FROM bookings WHERE date = ?
      )
      ORDER BY time_slot
    `, [date]);

    res.json({
      date,
      free_trainers: freeTrainers,
      free_zones: freeZones,
      free_time_slots: freeTimeSlots
    });

  } catch (err) {
    console.log('Ошибка отчета доступности:', err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});
