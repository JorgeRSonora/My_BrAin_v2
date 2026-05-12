import './load-env.js'
import express from 'express'
import cors from 'cors'
import bcrypt from 'bcrypt'
import { initDatabase, pool } from './sqlite-db.js'
import { groqGenerateText, parseJsonFromModel } from './ai/groq.js'

await initDatabase()

/** Claves Groq suelen empezar por `gsk_` */
const GROQ_KEY = (() => {
  const k = process.env.GROQ_API_KEY?.trim()
  return k && k.startsWith('gsk_') ? k : ''
})()

const app = express()
const PORT = Number(process.env.PORT) || 3001

// Middleware
app.use(cors())
app.use(express.json())

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

function parseUserId(req) {
  const q = req.query.userId ?? req.body?.userId
  const id = parseInt(String(q), 10)
  return Number.isFinite(id) && id > 0 ? id : null
}

// ============================================
// FINANZAS
// ============================================

app.get('/api/finanzas/movimientos', async (req, res) => {
  const userId = parseUserId(req)
  if (!userId) return res.status(400).json({ error: 'userId requerido' })

  const year = parseInt(req.query.year, 10) || new Date().getFullYear()
  const month = parseInt(req.query.month, 10) || new Date().getMonth() + 1

  try {
    const [rows] = await pool.execute(
      `SELECT id, tipo, monto, categoria, descripcion, fecha, hucha_id, created_at
       FROM movimientos_financieros
       WHERE usuario_id = ? AND strftime('%Y', fecha) = ? AND CAST(strftime('%m', fecha) AS INTEGER) = ?
       ORDER BY fecha DESC, id DESC`,
      [userId, String(year), month]
    )
    res.json({ movimientos: rows })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al cargar movimientos' })
  }
})

app.get('/api/finanzas/resumen', async (req, res) => {
  const userId = parseUserId(req)
  if (!userId) return res.status(400).json({ error: 'userId requerido' })

  const year = parseInt(req.query.year, 10) || new Date().getFullYear()
  const month = parseInt(req.query.month, 10) || new Date().getMonth() + 1

  try {
    const [ing] = await pool.execute(
      `SELECT COALESCE(SUM(monto), 0) AS total FROM movimientos_financieros
       WHERE usuario_id = ? AND tipo = 'ingreso' AND strftime('%Y', fecha) = ? AND CAST(strftime('%m', fecha) AS INTEGER) = ?`,
      [userId, String(year), month]
    )
    const [gas] = await pool.execute(
      `SELECT COALESCE(SUM(monto), 0) AS total FROM movimientos_financieros
       WHERE usuario_id = ? AND tipo = 'gasto' AND strftime('%Y', fecha) = ? AND CAST(strftime('%m', fecha) AS INTEGER) = ?`,
      [userId, String(year), month]
    )
    const [ahorroRows] = await pool.execute(
      `SELECT COALESCE(SUM(monto), 0) AS total FROM movimientos_financieros
       WHERE usuario_id = ? AND tipo = 'aportacion_hucha' AND strftime('%Y', fecha) = ? AND CAST(strftime('%m', fecha) AS INTEGER) = ?`,
      [userId, String(year), month]
    )
    const ingresos = Number(ing[0]?.total ?? 0)
    const gastos = Number(gas[0]?.total ?? 0)
    const ahorro_aportado = Number(ahorroRows[0]?.total ?? 0)
    const balance = ingresos - gastos - ahorro_aportado
    res.json({ ingresos, gastos, ahorro_aportado, balance })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al calcular resumen' })
  }
})

app.post('/api/finanzas/movimientos', async (req, res) => {
  const userId = parseUserId(req)
  const { tipo, monto, categoria, descripcion, fecha, hucha_id } = req.body || {}

  if (!userId) return res.status(400).json({ error: 'userId requerido' })
  if (!['ingreso', 'gasto', 'aportacion_hucha'].includes(tipo)) {
    return res.status(400).json({ error: 'tipo debe ser ingreso, gasto o aportacion_hucha' })
  }
  const hid = hucha_id != null ? parseInt(String(hucha_id), 10) : null
  if (tipo === 'aportacion_hucha') {
    if (!Number.isFinite(hid) || hid <= 0) {
      return res.status(400).json({ error: 'aportacion_hucha requiere hucha_id válido' })
    }
  }
  const cantidad = Number(monto)
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    return res.status(400).json({ error: 'monto inválido' })
  }
  if (!fecha) return res.status(400).json({ error: 'fecha requerida' })

  try {
    if (tipo === 'aportacion_hucha') {
      const [[jar]] = await pool.execute(`SELECT id FROM huchas_ahorro WHERE id = ? AND usuario_id = ?`, [
        hid,
        userId,
      ])
      if (!jar) return res.status(400).json({ error: 'Hucha no encontrada' })
    }

    const [result] = await pool.execute(
      `INSERT INTO movimientos_financieros (usuario_id, tipo, monto, categoria, descripcion, fecha, hucha_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        tipo,
        cantidad,
        categoria?.slice(0, 80) || null,
        descripcion?.slice(0, 500) || null,
        fecha,
        tipo === 'aportacion_hucha' ? hid : null,
      ]
    )

    if (tipo === 'aportacion_hucha') {
      await pool.execute(`UPDATE huchas_ahorro SET saldo = saldo + ? WHERE id = ? AND usuario_id = ?`, [
        cantidad,
        hid,
        userId,
      ])
    }

    res.status(201).json({
      movimiento: {
        id: result.insertId,
        usuario_id: userId,
        tipo,
        monto: cantidad,
        categoria,
        descripcion,
        fecha,
        hucha_id: tipo === 'aportacion_hucha' ? hid : null,
      },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'No se pudo guardar el movimiento' })
  }
})

app.delete('/api/finanzas/movimientos/:id', async (req, res) => {
  const userId = parseUserId(req)
  if (!userId) return res.status(400).json({ error: 'userId requerido (query)' })

  const id = parseInt(req.params.id, 10)
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'id inválido' })

  try {
    const [prevRows] = await pool.execute(
      `SELECT tipo, monto, hucha_id FROM movimientos_financieros WHERE id = ? AND usuario_id = ?`,
      [id, userId]
    )
    const prev = prevRows[0]
    if (!prev) return res.status(404).json({ error: 'No encontrado' })

    const [r] = await pool.execute(
      'DELETE FROM movimientos_financieros WHERE id = ? AND usuario_id = ?',
      [id, userId]
    )
    if (r.affectedRows === 0) return res.status(404).json({ error: 'No encontrado' })

    if (prev.tipo === 'aportacion_hucha' && prev.hucha_id) {
      await pool.execute(
        `UPDATE huchas_ahorro SET saldo = saldo - ? WHERE id = ? AND usuario_id = ?`,
        [Number(prev.monto), prev.hucha_id, userId]
      )
    }

    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al eliminar' })
  }
})

// --- Huchas de ahorro ---
app.get('/api/finanzas/huchas', async (req, res) => {
  const userId = parseUserId(req)
  if (!userId) return res.status(400).json({ error: 'userId requerido' })
  try {
    const [rows] = await pool.execute(
      `SELECT id, nombre, objetivo, saldo, orden, created_at FROM huchas_ahorro
       WHERE usuario_id = ? ORDER BY orden ASC, id ASC`,
      [userId]
    )
    res.json({ huchas: rows })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al cargar huchas' })
  }
})

app.post('/api/finanzas/huchas', async (req, res) => {
  const userId = parseUserId(req)
  const { nombre, objetivo, orden } = req.body || {}
  if (!userId) return res.status(400).json({ error: 'userId requerido' })
  if (!nombre?.trim()) return res.status(400).json({ error: 'nombre requerido' })
  try {
    const obj = objetivo != null && objetivo !== '' ? Number(objetivo) : null
    const ord = orden != null ? parseInt(String(orden), 10) : 0
    const [result] = await pool.execute(
      `INSERT INTO huchas_ahorro (usuario_id, nombre, objetivo, orden) VALUES (?, ?, ?, ?)`,
      [userId, nombre.trim().slice(0, 120), Number.isFinite(obj) ? obj : null, Number.isFinite(ord) ? ord : 0]
    )
    res.status(201).json({ id: result.insertId })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'No se pudo crear la hucha' })
  }
})

app.patch('/api/finanzas/huchas/:id', async (req, res) => {
  const userId = parseUserId(req)
  const id = parseInt(req.params.id, 10)
  const { nombre, objetivo, orden } = req.body || {}
  if (!userId) return res.status(400).json({ error: 'userId requerido' })
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'id inválido' })
  try {
    const fields = []
    const vals = []
    if (nombre != null) {
      fields.push('nombre = ?')
      vals.push(String(nombre).trim().slice(0, 120))
    }
    if (objetivo !== undefined) {
      fields.push('objetivo = ?')
      vals.push(objetivo === null || objetivo === '' ? null : Number(objetivo))
    }
    if (orden !== undefined) {
      fields.push('orden = ?')
      vals.push(parseInt(String(orden), 10) || 0)
    }
    if (fields.length === 0) return res.status(400).json({ error: 'Nada que actualizar' })
    vals.push(id, userId)
    const [r] = await pool.execute(
      `UPDATE huchas_ahorro SET ${fields.join(', ')} WHERE id = ? AND usuario_id = ?`,
      vals
    )
    if (r.affectedRows === 0) return res.status(404).json({ error: 'No encontrado' })
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar' })
  }
})

app.delete('/api/finanzas/huchas/:id', async (req, res) => {
  const userId = parseUserId(req)
  const id = parseInt(req.params.id, 10)
  if (!userId) return res.status(400).json({ error: 'userId requerido' })
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'id inválido' })
  try {
    const [r] = await pool.execute(`DELETE FROM huchas_ahorro WHERE id = ? AND usuario_id = ?`, [id, userId])
    if (r.affectedRows === 0) return res.status(404).json({ error: 'No encontrado' })
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al eliminar' })
  }
})

// --- Eventos próximos ---
app.get('/api/eventos', async (req, res) => {
  const userId = parseUserId(req)
  if (!userId) return res.status(400).json({ error: 'userId requerido' })

  const hoy = new Date().toISOString().slice(0, 10)
  try {
    const [rows] = await pool.execute(
      `SELECT id, titulo, fecha_evento, descripcion, created_at FROM eventos
       WHERE usuario_id = ? AND fecha_evento >= ?
       ORDER BY fecha_evento ASC, id ASC`,
      [userId, hoy]
    )
    res.json({ eventos: rows })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: sqliteFriendlyError(err, 'Error al cargar eventos') })
  }
})

app.post('/api/eventos', async (req, res) => {
  const userId = parseUserId(req)
  const { titulo, fecha_evento, descripcion } = req.body || {}

  if (!userId) return res.status(400).json({ error: 'userId requerido' })
  if (!titulo?.trim()) return res.status(400).json({ error: 'titulo requerido' })
  if (!fecha_evento?.trim()) return res.status(400).json({ error: 'fecha del evento requerida' })

  try {
    const [result] = await pool.execute(
      `INSERT INTO eventos (usuario_id, titulo, fecha_evento, descripcion) VALUES (?, ?, ?, ?)`,
      [
        userId,
        titulo.trim().slice(0, 200),
        String(fecha_evento).trim().slice(0, 10),
        descripcion?.trim() ? descripcion.trim().slice(0, 500) : null,
      ]
    )
    res.status(201).json({ id: result.insertId })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'No se pudo crear el evento' })
  }
})

app.delete('/api/eventos/:id', async (req, res) => {
  const userId = parseUserId(req)
  const id = parseInt(req.params.id, 10)
  if (!userId) return res.status(400).json({ error: 'userId requerido' })
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'id inválido' })
  try {
    const [r] = await pool.execute(`DELETE FROM eventos WHERE id = ? AND usuario_id = ?`, [id, userId])
    if (r.affectedRows === 0) return res.status(404).json({ error: 'No encontrado' })
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al eliminar' })
  }
})

// ============================================
// ALIMENTACIÓN — menús y lista de compra
// ============================================

const PLATOS_SUGERIDOS = {
  desayuno: [
    'Avena con frutos rojos y nueces',
    'Tostadas integrales con aguacate y huevo',
    'Yogur griego con granola y miel',
    'Tortilla francesa con espárragos',
    'Pan integral con tomate y aceite de oliva',
    'Smoothie de plátano y espinacas',
    'Chía pudding con mango',
  ],
  comida: [
    'Pollo al horno con verduras asadas',
    'Ensalada de quinoa, garbanzos y feta',
    'Salmón a la plancha con arroz integral',
    'Lentejas estofadas con verduras',
    'Pasta integral con pesto y cherry',
    'Merluza en salsa verde con patata',
    'Arroz con verduras y tofu salteado',
  ],
  cena: [
    'Crema de calabaza y zanahoria',
    'Ensalada mixta con atún y huevo',
    'Sopa de miso con tofu y algas',
    'Revuelto de setas y espárragos',
    'Tortilla de patata ligera con ensalada',
    'Pescado al vapor con brócoli',
    'Wrap de pollo y verduras a la plancha',
  ],
}

function pick(arr, seed) {
  return arr[Math.abs(seed) % arr.length]
}

function normListaItem(s) {
  return String(s || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 200)
}

/** "Huevos x3" → nombre canónico + factor (para sumar sin filas duplicadas). */
function splitListaNombreCantidad(itemStr) {
  const t = normListaItem(itemStr)
  const m = t.match(/^(.+?)\s*(?:x|×)\s*(\d+)\s*$/i)
  if (m) {
    const qty = Math.min(9999, Math.max(1, parseInt(m[2], 10) || 1))
    return { nombre: normListaItem(m[1]).slice(0, 200), qtyMul: qty }
  }
  return { nombre: t.slice(0, 200), qtyMul: 1 }
}

/** Agrupa líneas repetidas del mismo producto sumando unidades. */
function aggregateProductosLista(productos) {
  const map = new Map()
  for (const p of productos) {
    const item = normListaItem(p)
    if (!item) continue
    const { nombre, qtyMul } = splitListaNombreCantidad(item)
    const canon = nombre
    if (!canon) continue
    const key = canon.toLowerCase()
    const prev = map.get(key)
    const add = qtyMul
    if (!prev) map.set(key, { nombre: canon, cantidad: add })
    else prev.cantidad = Math.min(9999, prev.cantidad + add)
  }
  return [...map.values()]
}

async function listaCompraSumarCantidad(userId, nombreRaw, unidadesExtra = 1) {
  const { nombre, qtyMul } = splitListaNombreCantidad(nombreRaw)
  const canon = normListaItem(nombre).slice(0, 200)
  const u = Math.floor(Number(unidadesExtra) || 1)
  const add = Math.min(9999, Math.max(1, u * qtyMul))
  if (!canon || add <= 0) return { ok: false, unidades: 0 }

  const [rows] = await pool.execute(
    `SELECT id, COALESCE(cantidad, 1) AS cantidad FROM lista_compra WHERE usuario_id = ? AND LOWER(TRIM(item)) = LOWER(?)`,
    [userId, canon]
  )
  if (!rows.length) {
    await pool.execute(
      `INSERT INTO lista_compra (usuario_id, item, cantidad, comprado) VALUES (?, ?, ?, 0)`,
      [userId, canon, add]
    )
    return { ok: true, unidades: add }
  }
  const nueva = Math.min(9999, (Number(rows[0].cantidad) || 1) + add)
  await pool.execute(`UPDATE lista_compra SET cantidad = ? WHERE id = ? AND usuario_id = ?`, [
    nueva,
    rows[0].id,
    userId,
  ])
  return { ok: true, unidades: add }
}

/** Si no hay IA: fragmenta platos en trozos; permite repetidos para luego agrupar xN. */
function listaProductosDesdeMenuPorTexto(rows) {
  const out = []
  for (const r of rows) {
    const text = [r.plato, r.notas].filter(Boolean).join(' · ')
    const bits = text.split(/\s*(?:,|;|\/|\||·|\s+y\s+|\s+con\s+)\s*/i)
    for (let b of bits) {
      b = normListaItem(b)
      if (b.length < 2 || b.length > 90) continue
      out.push(b.charAt(0).toUpperCase() + b.slice(1))
    }
  }
  return out.slice(0, 120)
}

async function listaProductosGroqDesdeMenu(apiKey, rows) {
  const lines = rows.map(
    (r) =>
      `- ${r.fecha} (${r.momento}): ${r.plato}${r.notas ? `. Notas: ${r.notas}` : ''}`
  )
  const prompt = `Eres ayudante de compras para cocina casera en España.

A partir del menú siguiente, deduce una lista de COMPRA de supermercado: ingredientes y productos necesarios para preparar esos platos durante el periodo indicado.
- Incluye verduras, fruta, carnes/pescados, lácteos, huevos, legumbres secas, arroz/pasta, especias básicas, aceite, pan, etc. cuando encajen con los platos.
- No repitas el mismo producto en distintas líneas; si hace falta más cantidad usa un solo ítem con sufijo (ej. "Huevos x6", "Tomates cherry x2").
- Cantidades opcionales entre paréntesis si ayuda (ej. "Leche entera (1 L)").
- Entre 15 y 55 ítems según complejidad del menú.
- Nombres cortos en español.

Responde ÚNICAMENTE con JSON válido (sin markdown ni texto extra):
{"productos":["ítem 1","ítem 2",...]}

Menú:
${lines.join('\n')}`

  const { text } = await groqGenerateText(apiKey, prompt, {
    temperature: 0.35,
    maxOutputTokens: 4096,
  })
  const parsed = parseJsonFromModel(text)
  const arr = parsed?.productos
  if (!Array.isArray(arr) || arr.length === 0) {
    throw new Error('La IA no devolvió la lista en el formato esperado.')
  }
  return arr.map(normListaItem).filter(Boolean).slice(0, 60)
}

function sqliteFriendlyError(err, accion) {
  const msg = String(err?.message || '')
  if (msg.includes('no such table')) {
    return `${accion}: borra backend/database/database.sqlite y reinicia el servidor para recrear tablas.`
  }
  return `${accion}. Si persiste, mira el error en la terminal del servidor.`
}

app.get('/api/alimentacion/menu', async (req, res) => {
  const userId = parseUserId(req)
  if (!userId) return res.status(400).json({ error: 'userId requerido' })

  const { from, to } = req.query
  if (!from || !to) return res.status(400).json({ error: 'from y to (YYYY-MM-DD) requeridos' })

  try {
    const [rows] = await pool.execute(
      `SELECT id, fecha, momento, plato, notas FROM comidas_menu
       WHERE usuario_id = ? AND fecha BETWEEN ? AND ?
       ORDER BY fecha,
         CASE momento WHEN 'desayuno' THEN 1 WHEN 'comida' THEN 2 WHEN 'cena' THEN 3 ELSE 4 END`,
      [userId, from, to]
    )
    res.json({ menus: rows })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: sqliteFriendlyError(err, 'Error al cargar menús') })
  }
})

app.post('/api/alimentacion/menu', async (req, res) => {
  const userId = parseUserId(req)
  const { fecha, momento, plato, notas } = req.body || {}

  if (!userId) return res.status(400).json({ error: 'userId requerido' })
  if (!fecha || !momento || !plato) {
    return res.status(400).json({ error: 'fecha, momento y plato son obligatorios' })
  }
  if (!['desayuno', 'comida', 'cena'].includes(momento)) {
    return res.status(400).json({ error: 'momento inválido' })
  }

  try {
    await pool.execute(
      `INSERT INTO comidas_menu (usuario_id, fecha, momento, plato, notas)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(usuario_id, fecha, momento) DO UPDATE SET
         plato = excluded.plato,
         notas = excluded.notas`,
      [userId, fecha, momento, plato.slice(0, 255), notas?.slice(0, 500) || null]
    )
    const [last] = await pool.execute(
      `SELECT id FROM comidas_menu WHERE usuario_id = ? AND fecha = ? AND momento = ?`,
      [userId, fecha, momento]
    )
    res.status(201).json({ ok: true, id: last[0]?.id })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'No se pudo guardar el menú' })
  }
})

app.delete('/api/alimentacion/menu/:id', async (req, res) => {
  const userId = parseUserId(req)
  if (!userId) return res.status(400).json({ error: 'userId requerido' })

  const id = parseInt(req.params.id, 10)
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'id inválido' })

  try {
    const [r] = await pool.execute('DELETE FROM comidas_menu WHERE id = ? AND usuario_id = ?', [
      id,
      userId,
    ])
    if (r.affectedRows === 0) return res.status(404).json({ error: 'No encontrado' })
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al eliminar' })
  }
})

app.post('/api/alimentacion/menu/generar-semana', async (req, res) => {
  const userId = parseUserId(req)
  if (!userId) return res.status(400).json({ error: 'userId requerido' })

  try {
    const start = new Date()
    start.setHours(12, 0, 0, 0)
    const momentos = ['desayuno', 'comida', 'cena']

    for (let d = 0; d < 7; d++) {
      const day = new Date(start)
      day.setDate(start.getDate() + d)
      const iso = day.toISOString().slice(0, 10)
      const seedBase = userId * 100 + d * 17

      for (let m = 0; m < momentos.length; m++) {
        const momento = momentos[m]
        const plato = pick(PLATOS_SUGERIDOS[momento], seedBase + m * 31)
        await pool.execute(
          `INSERT INTO comidas_menu (usuario_id, fecha, momento, plato, notas)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(usuario_id, fecha, momento) DO UPDATE SET
             plato = excluded.plato,
             notas = excluded.notas`,
          [userId, iso, momento, plato, null]
        )
      }
    }

    res.json({ ok: true, mensaje: 'Menú de 7 días generado desde hoy' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'No se pudo generar el menú' })
  }
})

app.get('/api/alimentacion/lista', async (req, res) => {
  const userId = parseUserId(req)
  if (!userId) return res.status(400).json({ error: 'userId requerido' })

  try {
    const [rows] = await pool.execute(
      `SELECT id, item, COALESCE(cantidad, 1) AS cantidad, comprado FROM lista_compra WHERE usuario_id = ? ORDER BY comprado ASC, id DESC`,
      [userId]
    )
    res.json({ items: rows })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: sqliteFriendlyError(err, 'Error al cargar lista') })
  }
})

app.post('/api/alimentacion/lista', async (req, res) => {
  const userId = parseUserId(req)
  const { item } = req.body || {}

  if (!userId) return res.status(400).json({ error: 'userId requerido' })
  if (!item?.trim()) return res.status(400).json({ error: 'item requerido' })

  try {
    const r = await listaCompraSumarCantidad(userId, item.trim(), 1)
    if (!r.ok) return res.status(400).json({ error: 'Ítem no válido' })
    res.status(201).json({ ok: true, unidades: r.unidades })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'No se pudo añadir' })
  }
})

app.patch('/api/alimentacion/lista/:id', async (req, res) => {
  const userId = parseUserId(req)
  const { comprado } = req.body || {}
  const id = parseInt(req.params.id, 10)

  if (!userId) return res.status(400).json({ error: 'userId requerido' })
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'id inválido' })
  if (typeof comprado !== 'boolean') return res.status(400).json({ error: 'comprado debe ser boolean' })

  try {
    const [r] = await pool.execute(
      'UPDATE lista_compra SET comprado = ? WHERE id = ? AND usuario_id = ?',
      [comprado ? 1 : 0, id, userId]
    )
    if (r.affectedRows === 0) return res.status(404).json({ error: 'No encontrado' })
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar' })
  }
})

app.delete('/api/alimentacion/lista/:id', async (req, res) => {
  const userId = parseUserId(req)
  const id = parseInt(req.params.id, 10)

  if (!userId) return res.status(400).json({ error: 'userId requerido' })
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'id inválido' })

  try {
    const [r] = await pool.execute('DELETE FROM lista_compra WHERE id = ? AND usuario_id = ?', [
      id,
      userId,
    ])
    if (r.affectedRows === 0) return res.status(404).json({ error: 'No encontrado' })
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al eliminar' })
  }
})

/**
 * Genera ítems de lista de compra a partir del menú en [from, to].
 * Sin from/to: usa la semana ISO actual (lunes–domingo).
 * Con IA (Groq): ingredientes razonables; si falla o no hay clave: trocea platos (menos preciso).
 * Los nuevos ítems se fusionan con la lista existente (sin duplicar por nombre, ignorando mayúsculas).
 */
app.post('/api/alimentacion/lista/desde-menu', async (req, res) => {
  const userId = parseUserId(req)
  let { from, to } = req.body || {}

  if (!userId) return res.status(400).json({ error: 'userId requerido' })

  if (!from || !to) {
    const hoy = new Date().toISOString().slice(0, 10)
    from = mondayOfWeekContaining(hoy)
    to = addDaysIso(from, 6)
  }

  try {
    const [menus] = await pool.execute(
      `SELECT fecha, momento, plato, notas FROM comidas_menu
       WHERE usuario_id = ? AND fecha BETWEEN ? AND ?
       ORDER BY fecha,
         CASE momento WHEN 'desayuno' THEN 1 WHEN 'comida' THEN 2 WHEN 'cena' THEN 3 ELSE 4 END`,
      [userId, from, to]
    )

    if (!menus.length) {
      return res.status(400).json({
        error:
          'No hay platos en el menú para ese periodo. Genera o rellena el menú primero en Alimentación.',
      })
    }

    let productos = []
    let origen = 'texto'
    if (GROQ_KEY) {
      try {
        productos = await listaProductosGroqDesdeMenu(GROQ_KEY, menus)
        origen = 'ia'
      } catch (e) {
        console.warn('[lista desde menú] IA:', e?.message || e)
        productos = listaProductosDesdeMenuPorTexto(menus)
        origen = 'texto'
      }
    } else {
      productos = listaProductosDesdeMenuPorTexto(menus)
    }

    const agregados = aggregateProductosLista(productos)
    let unidadesAñadidas = 0
    let lineasTocadas = 0
    for (const row of agregados) {
      const r = await listaCompraSumarCantidad(userId, row.nombre, row.cantidad)
      if (r.ok) {
        lineasTocadas += 1
        unidadesAñadidas += r.unidades
      }
    }

    const [totalRows] = await pool.execute(
      `SELECT COUNT(*) AS n FROM lista_compra WHERE usuario_id = ?`,
      [userId]
    )
    const totalLista = totalRows[0]?.n ?? 0

    res.json({
      ok: true,
      origen,
      periodo: { from, to },
      generados: productos.length,
      productosUnicos: agregados.length,
      unidadesAñadidas,
      lineasTocadas,
      totalLista,
      aviso:
        origen === 'texto'
          ? 'Lista aproximada desde los nombres de los platos. Para ingredientes más útiles, configura GROQ_API_KEY en el servidor.'
          : undefined,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: sqliteFriendlyError(err, 'No se pudo generar la lista desde el menú') })
  }
})

// ============================================
// IA (Groq — finanzas personales y menú semanal)
// ============================================

app.get('/api/ai/status', (req, res) => {
  res.json({
    groq: Boolean(GROQ_KEY && GROQ_KEY.length > 8),
    ayuda: 'Crea GROQ_API_KEY en backend/server/.env (https://console.groq.com/)',
  })
})

function addDaysIso(iso, n) {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function mondayOfWeekContaining(isoDate) {
  const d = new Date(`${isoDate}T12:00:00`)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

app.post('/api/ai/menu-semanal', async (req, res) => {
  const userId = parseUserId(req)
  const { preferencias, semanaInicio } = req.body || {}

  if (!userId) return res.status(400).json({ error: 'userId requerido' })
  if (!GROQ_KEY) {
    return res.status(503).json({
      error: 'IA no configurada. Añade GROQ_API_KEY en backend/server/.env (https://console.groq.com/).',
    })
  }

  try {
    const [[user]] = await pool.execute('SELECT nombre FROM usuarios WHERE id = ?', [userId])
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' })

    const anchor = semanaInicio || new Date().toISOString().slice(0, 10)
    const lunes = mondayOfWeekContaining(anchor)
    const fechas = Array.from({ length: 7 }, (_, i) => addDaysIso(lunes, i))

    const prompt = `Eres nutricionista. Propón un menú casero para una semana en España.
Usuario: ${user.nombre}.
Preferencias / restricciones: ${preferencias || 'Dieta equilibrada, cocina sencilla, sin alimentos caros.'}

Debes usar EXACTAMENTE estas fechas en orden (ISO YYYY-MM-DD), una por día:
${fechas.join(', ')}

Responde ÚNICAMENTE con un JSON válido (sin markdown ni texto extra) con esta forma exacta:
{"dias":[{"fecha":"YYYY-MM-DD","desayuno":"...","comida":"...","cena":"..."}]}

7 elementos en "dias". Platos concretos en español, variados y realistas.`

    const { text, model } = await groqGenerateText(GROQ_KEY, prompt)
    let parsed
    try {
      parsed = parseJsonFromModel(text)
    } catch {
      return res.status(502).json({
        error: 'La IA no devolvió JSON válido. Inténtalo de nuevo.',
        raw: text.slice(0, 500),
      })
    }

    const dias = parsed?.dias
    if (!Array.isArray(dias) || dias.length !== 7) {
      return res.status(502).json({ error: 'Formato de menú incorrecto de la IA.' })
    }

    const momentos = ['desayuno', 'comida', 'cena']
    for (let i = 0; i < 7; i++) {
      const esperada = fechas[i]
      const dia = dias[i]
      const fechaUsar = fechas.includes(dia?.fecha) ? dia.fecha : esperada

      for (const m of momentos) {
        const plato = String(dia?.[m] || '').slice(0, 255) || pick(PLATOS_SUGERIDOS[m], userId + i)
        await pool.execute(
          `INSERT INTO comidas_menu (usuario_id, fecha, momento, plato, notas)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(usuario_id, fecha, momento) DO UPDATE SET
             plato = excluded.plato,
             notas = excluded.notas`,
          [
            userId,
            fechaUsar,
            m,
            plato,
            `IA (${model})`,
          ]
        )
      }
    }

    res.json({
      ok: true,
      fuente: 'groq',
      modelo: model,
      desde: fechas[0],
      hasta: fechas[6],
      mensaje: 'Menú semanal generado y guardado.',
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Error al generar menú con IA' })
  }
})

app.post('/api/ai/menu-diario', async (req, res) => {
  const userId = parseUserId(req)
  const { preferencias, fecha } = req.body || {}

  if (!userId) return res.status(400).json({ error: 'userId requerido' })
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(String(fecha).trim())) {
    return res.status(400).json({ error: 'fecha obligatoria (YYYY-MM-DD)' })
  }
  const fechaIso = String(fecha).trim().slice(0, 10)

  if (!GROQ_KEY) {
    return res.status(503).json({
      error: 'IA no configurada. Añade GROQ_API_KEY en backend/server/.env (https://console.groq.com/).',
    })
  }

  try {
    const [[user]] = await pool.execute('SELECT nombre FROM usuarios WHERE id = ?', [userId])
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' })

    const prompt = `Eres nutricionista. Propón un menú casero para UN SOLO DÍA en España.
Usuario: ${user.nombre}.
Fecha del día (ISO): ${fechaIso}.
Preferencias / restricciones: ${preferencias || 'Dieta equilibrada, cocina sencilla, sin alimentos caros.'}

Responde ÚNICAMENTE con un JSON válido (sin markdown ni texto extra) con esta forma exacta:
{"desayuno":"...","comida":"...","cena":"..."}

Platos concretos en español, variados y realistas para ese día.`

    const { text, model } = await groqGenerateText(GROQ_KEY, prompt)
    let parsed
    try {
      parsed = parseJsonFromModel(text)
    } catch {
      return res.status(502).json({
        error: 'La IA no devolvió JSON válido. Inténtalo de nuevo.',
        raw: text.slice(0, 500),
      })
    }

    const momentos = ['desayuno', 'comida', 'cena']
    for (let i = 0; i < momentos.length; i++) {
      const m = momentos[i]
      const plato =
        String(parsed?.[m] || '').slice(0, 255) ||
        pick(PLATOS_SUGERIDOS[m], userId + i * 17 + parseInt(fechaIso.replace(/-/g, ''), 10) || 0)
      await pool.execute(
        `INSERT INTO comidas_menu (usuario_id, fecha, momento, plato, notas)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(usuario_id, fecha, momento) DO UPDATE SET
           plato = excluded.plato,
           notas = excluded.notas`,
        [userId, fechaIso, m, plato, `IA (${model})`]
      )
    }

    res.json({
      ok: true,
      fuente: 'groq',
      modelo: model,
      fecha: fechaIso,
      mensaje: 'Menú del día generado y guardado.',
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Error al generar menú diario con IA' })
  }
})

app.post('/api/ai/informe-finanzas', async (req, res) => {
  const userId = parseUserId(req)
  const { semanaInicio } = req.body || {}

  if (!userId) return res.status(400).json({ error: 'userId requerido' })
  if (!GROQ_KEY) {
    return res.status(503).json({
      error:
        'IA no configurada. Añade GROQ_API_KEY en backend/server/.env (https://console.groq.com/).',
    })
  }

  try {
    const [[user]] = await pool.execute('SELECT nombre FROM usuarios WHERE id = ?', [userId])
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' })

    const anchor = semanaInicio || new Date().toISOString().slice(0, 10)
    const desde = mondayOfWeekContaining(anchor)
    const hasta = addDaysIso(desde, 6)

    const [movs] = await pool.execute(
      `SELECT tipo, monto, categoria, descripcion, fecha
       FROM movimientos_financieros
       WHERE usuario_id = ? AND fecha >= ? AND fecha <= ?
       ORDER BY fecha ASC, id ASC`,
      [userId, desde, hasta]
    )

    const ingresos = movs.filter((m) => m.tipo === 'ingreso').reduce((s, m) => s + Number(m.monto), 0)
    const gastos = movs.filter((m) => m.tipo === 'gasto').reduce((s, m) => s + Number(m.monto), 0)
    const balance = ingresos - gastos

    const prompt = `Actúa como asesor financiero para un proyecto educativo (ESO / FP / universidad).
Redacta un INFORME SEMANAL claro en español para la persona "${user.nombre}".

Semana natural: del ${desde} al ${hasta} (ambos inclusive).

Totales de la semana (€):
- Ingresos: ${ingresos.toFixed(2)}
- Gastos: ${gastos.toFixed(2)}
- Balance: ${balance.toFixed(2)}

Movimientos (JSON, puede estar vacío):
${JSON.stringify(movs, null, 0)}

Instrucciones:
1) Empieza con un título en una línea: "# Informe semanal (${desde} – ${hasta})"
2) Resumen ejecutivo (4–8 frases) basado SOLO en estos datos.
3) Sección "## Observaciones" con viñetas.
4) Sección "## Recomendaciones" con 3 consejos prácticos y realistas.
5) Si no hay movimientos, indica que no hay datos y sugiere registrar gastos/ingresos.
No inventes cifras. Usa Markdown simple (títulos ## y listas con -).`

    const { text, model } = await groqGenerateText(GROQ_KEY, prompt, { temperature: 0.5 })

    res.json({
      ok: true,
      fuente: 'groq',
      modelo: model,
      desde,
      hasta,
      totales: { ingresos, gastos, balance },
      informeMarkdown: text,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Error al generar informe' })
  }
})

// ============================================
// Iniciar servidor
// ============================================
app.listen(PORT, () => {
  console.log(`🧠 MyBrAIn Server corriendo en http://localhost:${PORT}`)
  if (GROQ_KEY) {
    console.log('🤖 IA: Groq configurada (menú semanal + informes financieros)')
  } else {
    console.log('💡 IA: añade GROQ_API_KEY en server/.env — https://console.groq.com/')
  }
})
