const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const pool = require('./db');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());

const JWT_SECRET = "supersecret";

// ====== Корневой маршрут — регистрация ======
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/register.html'));
});

// ====== Раздача статики (CSS, JS, изображения) ======
app.use(express.static(path.join(__dirname, '../frontend')));

// ====== AUTH: REGISTER ======
app.post('/auth/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const [rows] = await pool.query("SELECT id FROM users WHERE email = ?", [email]);
        if (rows.length > 0) {
            return res.status(400).json({ error: "Email already exists" });
        }
        const hash = await bcrypt.hash(password, 10);
        await pool.query(
            "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
            [name, email, hash]
        );
        res.json({ message: "Registered successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ====== AUTH: LOGIN ======
app.post('/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const [rows] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);
        if (rows.length === 0) {
            return res.status(400).json({ error: "Invalid email or password" });
        }
        const user = rows[0];
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(400).json({ error: "Invalid email or password" });
        }
        const token = jwt.sign(
            { id: user.id, role: user.role },
            JWT_SECRET,
            { expiresIn: "8h" }
        );
        res.json({ message: "Login successful", token });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ====== GET TRAINERS ======
app.get('/trainers', async (req, res) => {
    const [rows] = await pool.query("SELECT * FROM trainers");
    res.json(rows);
});

// ====== GET ZONES ======
app.get('/zones', async (req, res) => {
    const [rows] = await pool.query("SELECT * FROM zones");
    res.json(rows);
});

// ====== CREATE BOOKING ======
app.post('/booking', async (req, res) => {
    try {
        const { user_id, trainer_id, zone_id, date, start_time, duration_minutes, type } = req.body;
        await pool.query(
            `INSERT INTO bookings 
             (user_id, trainer_id, zone_id, date, start_time, duration_minutes, type)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [user_id, trainer_id, zone_id, date, start_time, duration_minutes, type]
        );
        res.json({ message: "Booking created" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ====== GET ALL BOOKINGS ======
app.get('/bookings', async (req, res) => {
    const [rows] = await pool.query(`
        SELECT 
            b.id,
            u.name AS user_name,
            t.name AS trainer_name,
            z.name AS zone_name,
            b.date,
            b.start_time,
            b.duration_minutes,
            b.type
        FROM bookings b
        JOIN users u ON b.user_id = u.id
        JOIN trainers t ON b.trainer_id = t.id
        JOIN zones z ON b.zone_id = z.id
        ORDER BY b.date, b.start_time
    `);
    res.json(rows);
});

// ====== Старт сервера ======
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
