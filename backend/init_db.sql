-- backend/init_db.sql
PRAGMA foreign_keys = ON;

-- Users (clients + admins)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  email TEXT UNIQUE,
  password TEXT,
  role TEXT DEFAULT 'client' -- 'client' или 'admin'
);

-- Trainers
CREATE TABLE IF NOT EXISTS trainers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  specialty TEXT
);

-- Zones
CREATE TABLE IF NOT EXISTS zones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  type TEXT
);

-- Time slots (hourly)
CREATE TABLE IF NOT EXISTS time_slots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  time_slot TEXT -- stored as 'HH:MM'
);

-- Bookings
CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  trainer_id INTEGER,
  zone_id INTEGER,
  date TEXT,        -- 'YYYY-MM-DD'
  start_time TEXT,  -- 'HH:MM'
  duration_minutes INTEGER,
  type TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(trainer_id) REFERENCES trainers(id),
  FOREIGN KEY(zone_id) REFERENCES zones(id)
);

-- Index to speed lookups
CREATE INDEX IF NOT EXISTS idx_bookings_date_time ON bookings(date, start_time);

-- --- Test data (won't duplicate because of UNIQUE constraints on email) ---

INSERT OR IGNORE INTO users (name, email, password, role)
VALUES
('Admin User','admin@fit.local','$2b$10$e0NRr1Bz4X1oB3kQdU0k5uIh8G1fK5GmYw9c3p8Y9y1eZcG6hQJ1e','admin'),
('Ivan Petrov','ivan@example.com','$2b$10$2w6R1R4o7l1v8gF7C9mS6u8KQ1hbiqk1cY2yHk8QvQ9JdG1mT2e5q','client');

INSERT OR IGNORE INTO trainers (id, name, specialty) VALUES
(1,'Иванова','personal'),
(2,'Сидоров','pilates'),
(3,'Петрова','yoga');

INSERT OR IGNORE INTO zones (id, name, type) VALUES
(1,'Кардио зона','cardio'),
(2,'Силовая зона','strength'),
(3,'Зал групповых - стандарт','group_standard'),
(4,'Зал премиум','premium'),
(5,'Студия йоги','yoga');

INSERT OR IGNORE INTO time_slots (id, time_slot) VALUES
(1,'08:00'),(2,'09:00'),(3,'10:00'),(4,'11:00'),(5,'12:00'),
(6,'13:00'),(7,'14:00'),(8,'15:00'),(9,'16:00'),(10,'17:00'),
(11,'18:00'),(12,'19:00'),(13,'20:00');