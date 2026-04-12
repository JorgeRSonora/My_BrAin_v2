-- ============================================
-- MyBrAIn - Base de datos MySQL
-- BD: mybrain | Usuario MySQL: mybrain_user
-- Login: admin / 1234
-- ============================================

USE mybrain;

-- ============================================
-- TABLA: usuarios
-- ============================================
CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  nombre VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  avatar VARCHAR(500) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================
-- Usuario por defecto: admin / 1234
-- Contraseña hasheada con bcrypt (10 rounds)
-- ============================================
INSERT INTO usuarios (username, nombre, email, password) VALUES
('admin', 'Admin', 'admin@mybrain.com', '$2b$10$Y4FgB1OSe3H8UogOAB5k0O7ITPzypGms7QvgmdRYf2b7j5TEDPHeK')
ON DUPLICATE KEY UPDATE nombre = nombre;
