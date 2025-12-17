CREATE DATABASE IF NOT EXISTS fitness_db;
USE fitness_db;

-- Users
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('client','admin') DEFAULT 'client'
);

-- Trainers
CREATE TABLE IF NOT EXISTS trainers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  specialty VARCHAR(255)
);

-- Zones
CREATE TABLE IF NOT EXISTS zones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255),
  type VARCHAR(50)
);

-- Time slots
CREATE TABLE IF NOT EXISTS time_slots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  time_slot TIME
);

-- Bookings
CREATE TABLE IF NOT EXISTS bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  trainer_id INT,
  zone_id INT,
  date DATE,
  start_time TIME,
  duration_minutes INT,
  type VARCHAR(50),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(trainer_id) REFERENCES trainers(id) ON DELETE CASCADE,
  FOREIGN KEY(zone_id) REFERENCES zones(id) ON DELETE CASCADE
);

-- Индекс для ускорения поиска
CREATE INDEX idx_bookings_date_time ON bookings(date,start_time);

-- Тестовые данные
INSERT IGNORE INTO users (name,email,password,role) VALUES
('Admin User','admin@fit.local','$2b$10$e0NRr1Bz4X1oB3kQdU0k5uIh8G1fK5GmYw9c3p8Y9y1eZcG6hQJ1e','admin'),
('Ivan Petrov','ivan@example.com','$2b$10$2w6R1R4o7l1v8gF7C9mS6u8KQ1hbiqk1cY2yHk8QvQ9JdG1mT2e5q','client');

INSERT IGNORE INTO trainers (name, specialty) VALUES
('Иванова','personal'),
('Сидоров','pilates'),
('Петрова','yoga');

INSERT IGNORE INTO zones (name,type) VALUES
('Кардио зона','cardio'),
('Силовая зона','strength'),
('Зал групповых - стандарт','group_standard'),
('Зал премиум','premium'),
('Студия йоги','yoga');

INSERT IGNORE INTO time_slots (time_slot) VALUES
('08:00:00'),('09:00:00'),('10:00:00'),('11:00:00'),('12:00:00'),
('13:00:00'),('14:00:00'),('15:00:00'),('16:00:00'),('17:00:00'),
('18:00:00'),('19:00:00'),('20:00:00');