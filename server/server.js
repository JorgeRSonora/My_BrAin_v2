import express from 'express'
import cors from 'cors'
import bcrypt from 'bcrypt'
import mysql from 'mysql2/promise'

const app = express()
const PORT = 3001

// Middleware
app.use(cors())
app.use(express.json())

// ============================================
// Conexión a MySQL
// ============================================
const pool = mysql.createPool({
  host: 'localhost',
  user: 'mybrain_user',
  password: 'MyBr4in_S3cur3!',
  database: 'mybrain',
  waitForConnections: true,
  connectionLimit: 10,
})

// Verificar conexión al iniciar
async function testConnection() {
  try {
    const conn = await pool.getConnection()
    console.log('✅ Conectado a MySQL - Base de datos: mybrain')
    conn.release()
  } catch (err) {
    console.error('❌ Error conectando a MySQL:', err.message)
    console.log('💡 Asegúrate de ejecutar: mysql -u root -p < ../database/init.sql')
  }
}

// ============================================
// RUTAS DE AUTENTICACIÓN
// ============================================

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son obligatorios' })
  }

  try {
    const [rows] = await pool.execute(
      'SELECT id, username, nombre, email, password, avatar FROM usuarios WHERE username = ?',
      [username]
    )

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' })
    }

    const user = rows[0]
    const passwordMatch = await bcrypt.compare(password, user.password)

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' })
    }

    // Devolver usuario sin la contraseña
    const { password: _, ...userData } = user
    res.json({ user: userData })
  } catch (err) {
    console.error('Error en login:', err)
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  const { username, nombre, email, password } = req.body

  if (!username || !nombre || !email || !password) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' })
  }

  try {
    // Comprobar si ya existe el usuario o email
    const [existing] = await pool.execute(
      'SELECT id FROM usuarios WHERE username = ? OR email = ?',
      [username, email]
    )

    if (existing.length > 0) {
      return res.status(409).json({ error: 'Ya existe una cuenta con ese usuario o email' })
    }

    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash(password, 10)

    const [result] = await pool.execute(
      'INSERT INTO usuarios (username, nombre, email, password) VALUES (?, ?, ?, ?)',
      [username, nombre, email, hashedPassword]
    )

    const user = {
      id: result.insertId,
      username,
      nombre,
      email,
    }

    res.status(201).json({ user })
  } catch (err) {
    console.error('Error en register:', err)
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// GET /api/auth/me (verificar sesión)
app.get('/api/auth/me', async (req, res) => {
  // Por ahora sin JWT, solo validación básica
  res.json({ ok: true })
})

// ============================================
// Iniciar servidor
// ============================================
app.listen(PORT, async () => {
  console.log(`🧠 MyBrAIn Server corriendo en http://localhost:${PORT}`)
  await testConnection()
})
