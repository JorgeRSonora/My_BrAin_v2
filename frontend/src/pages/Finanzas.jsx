import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Sidebar from '../components/Sidebar'

const fmt = (n) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)

function monthNow() {
  const d = new Date()
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

function lunesSemanaActualIso() {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const mon = new Date(now)
  mon.setDate(now.getDate() + diff)
  return mon.toISOString().slice(0, 10)
}

export default function Finanzas() {
  const { user } = useAuth()
  const location = useLocation()
  const userId = user?.id
  const [year, setYear] = useState(() => monthNow().year)
  const [month, setMonth] = useState(() => monthNow().month)
  const [resumen, setResumen] = useState({
    ingresos: 0,
    gastos: 0,
    ahorro_aportado: 0,
    balance: 0,
  })
  const [movimientos, setMovimientos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [huchas, setHuchas] = useState([])
  const [form, setForm] = useState({
    tipo: 'gasto',
    monto: '',
    categoria: '',
    descripcion: '',
    fecha: new Date().toISOString().slice(0, 10),
    hucha_id: '',
  })
  const [saving, setSaving] = useState(false)
  const [aiGroq, setAiGroq] = useState(false)
  const [informeMd, setInformeMd] = useState('')
  const [informeLoading, setInformeLoading] = useState(false)
  const [semanaInforme, setSemanaInforme] = useState(() => lunesSemanaActualIso())
  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setError('')
    try {
      const qs = new URLSearchParams({ userId: String(userId), year: String(year), month: String(month) })
      const [r1, r2, r3] = await Promise.all([
        fetch(`/api/finanzas/resumen?${qs}`),
        fetch(`/api/finanzas/movimientos?${qs}`),
        fetch(`/api/finanzas/huchas?userId=${userId}`),
      ])
      const j1 = await r1.json()
      const j2 = await r2.json()
      const j3 = await r3.json()
      if (!r1.ok) throw new Error(j1.error || 'Error resumen')
      if (!r2.ok) throw new Error(j2.error || 'Error movimientos')
      if (!r3.ok) throw new Error(j3.error || 'Error huchas')
      setResumen({
        ingresos: Number(j1.ingresos ?? 0),
        gastos: Number(j1.gastos ?? 0),
        ahorro_aportado: Number(j1.ahorro_aportado ?? 0),
        balance: Number(j1.balance ?? 0),
      })
      setMovimientos(j2.movimientos || [])
      setHuchas(j3.huchas || [])
    } catch (e) {
      setError(e.message || 'Error de red')
    } finally {
      setLoading(false)
    }
  }, [userId, year, month])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const tipo = location.state?.prefillTipo
    if (tipo === 'ingreso' || tipo === 'gasto' || tipo === 'aportacion_hucha') {
      setForm((f) => ({ ...f, tipo }))
    }
  }, [location.state])

  useEffect(() => {
    fetch('/api/ai/status')
      .then((r) => r.json())
      .then((d) => setAiGroq(!!d.groq))
      .catch(() => setAiGroq(false))
  }, [])

  const generarInforme = async () => {
    if (!userId) return
    setInformeLoading(true)
    setError('')
    try {
      const res = await fetch('/api/ai/informe-finanzas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, semanaInicio: semanaInforme }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al generar informe')
      setInformeMd(data.informeMarkdown || '')
    } catch (e) {
      setError(e.message)
    } finally {
      setInformeLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!userId) return
    const monto = parseFloat(String(form.monto).replace(',', '.'))
    if (!Number.isFinite(monto) || monto <= 0) {
      setError('Introduce un importe válido')
      return
    }
    if (form.tipo === 'aportacion_hucha' && !form.hucha_id) {
      setError('Elige una hucha para la aportación')
      return
    }
    setSaving(true)
    setError('')
    try {
      const payload = {
        userId,
        tipo: form.tipo,
        monto,
        categoria: form.categoria || null,
        descripcion: form.descripcion || null,
        fecha: form.fecha,
      }
      if (form.tipo === 'aportacion_hucha') {
        payload.hucha_id = parseInt(String(form.hucha_id), 10)
      }
      const res = await fetch('/api/finanzas/movimientos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar')
      setForm((f) => ({
        ...f,
        monto: '',
        categoria: '',
        descripcion: '',
        hucha_id: '',
      }))
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const eliminar = async (id) => {
    if (!userId || !confirm('¿Eliminar este movimiento?')) return
    try {
      const res = await fetch(`/api/finanzas/movimientos/${id}?userId=${userId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error')
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  const maxBar = Math.max(resumen.ingresos, resumen.gastos, 1)
  const pctIng = (resumen.ingresos / maxBar) * 100
  const pctGas = (resumen.gastos / maxBar) * 100

  return (
    <div className="dashboard-layout fin-page-bg">
      <Sidebar />
      <main className="dashboard-main">
        <header className="page-head animate-fade-in">
          <h1 className="dash-greeting">
            Finanzas — <span className="gradient-text">control mensual</span>
          </h1>
          <p className="dash-sub">Ingresos y gastos vinculados a tu cuenta.</p>
        </header>

        <div className="fin-toolbar glass animate-fade-in">
          <label>
            Mes{' '}
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(2000, i, 1).toLocaleString('es-ES', { month: 'long' })}
                </option>
              ))}
            </select>
          </label>
          <label>
            Año{' '}
            <input
              type="number"
              min={2020}
              max={2035}
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            />
          </label>
        </div>

        {error && (
          <p className="fin-error" role="alert">
            {error}
          </p>
        )}

        <section className="stats-grid animate-fade-in">
          <div className="stat-card glass">
            <div className="stat-icon">📈</div>
            <div className="stat-info">
              <p className="stat-label">Ingresos del mes</p>
              <p className="stat-value">{loading ? '…' : fmt(resumen.ingresos)}</p>
            </div>
          </div>
          <div className="stat-card glass">
            <div className="stat-icon">📉</div>
            <div className="stat-info">
              <p className="stat-label">Gastos del mes</p>
              <p className="stat-value">{loading ? '…' : fmt(resumen.gastos)}</p>
            </div>
          </div>
          <div className="stat-card glass">
            <div className="stat-icon">🏺</div>
            <div className="stat-info">
              <p className="stat-label">Ahorro en huchas (mes)</p>
              <p className="stat-value">{loading ? '…' : fmt(resumen.ahorro_aportado ?? 0)}</p>
            </div>
          </div>
          <div className="stat-card glass">
            <div className="stat-icon">⚖️</div>
            <div className="stat-info">
              <p className="stat-label">Balance</p>
              <p className={`stat-value ${resumen.balance >= 0 ? 'text-pos' : 'text-neg'}`}>
                {loading ? '…' : fmt(resumen.balance)}
              </p>
            </div>
          </div>
        </section>

        <section className="fin-chart glass animate-fade-in">
          <h2 className="section-title">Resumen visual</h2>
          <div className="fin-bars">
            <div>
              <span>Ingresos</span>
              <div className="fin-bar-track">
                <div className="fin-bar ing" style={{ width: `${pctIng}%` }} />
              </div>
            </div>
            <div>
              <span>Gastos</span>
              <div className="fin-bar-track">
                <div className="fin-bar gas" style={{ width: `${pctGas}%` }} />
              </div>
            </div>
          </div>
        </section>

        <section className="fin-form-section glass animate-fade-in">
          <h2 className="section-title">Registrar movimiento</h2>
          <form className="fin-form" onSubmit={handleSubmit}>
            <select
              value={form.tipo}
              onChange={(e) => setForm({ ...form, tipo: e.target.value, hucha_id: '' })}
            >
              <option value="ingreso">Ingreso</option>
              <option value="gasto">Gasto</option>
              <option value="aportacion_hucha">Aportación a hucha</option>
            </select>
            {form.tipo === 'aportacion_hucha' && (
              <select
                value={form.hucha_id}
                onChange={(e) => setForm({ ...form, hucha_id: e.target.value })}
                required
              >
                <option value="">— Hucha —</option>
                {huchas.map((h) => (
                  <option key={h.id} value={String(h.id)}>
                    {h.nombre} ({fmt(h.saldo)})
                  </option>
                ))}
              </select>
            )}
            <input
              type="text"
              inputMode="decimal"
              placeholder="Importe (€)"
              value={form.monto}
              onChange={(e) => setForm({ ...form, monto: e.target.value })}
              required
            />
            <input
              type="text"
              placeholder="Categoría"
              value={form.categoria}
              onChange={(e) => setForm({ ...form, categoria: e.target.value })}
            />
            <input
              type="date"
              value={form.fecha}
              onChange={(e) => setForm({ ...form, fecha: e.target.value })}
              required
            />
            <input
              type="text"
              placeholder="Descripción"
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
            />
            <button type="submit" className="btn-primary" disabled={saving || !userId}>
              {saving ? 'Guardando…' : 'Añadir'}
            </button>
          </form>
          <p className="muted fin-hucha-hint">
            Para crear huchas con meta de ahorro ve a <Link to="/eventos">Eventos</Link>.
          </p>
        </section>

        <section className="fin-table-wrap glass animate-fade-in">
          <h2 className="section-title">Movimientos del mes</h2>
          {loading ? (
            <p className="muted">Cargando…</p>
          ) : movimientos.length === 0 ? (
            <p className="muted">No hay movimientos este mes. Añade el primero arriba.</p>
          ) : (
            <table className="fin-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Importe</th>
                  <th>Categoría</th>
                  <th>Descripción</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {movimientos.map((m) => (
                  <tr key={m.id}>
                    <td>{m.fecha}</td>
                    <td>
                      {m.tipo === 'ingreso'
                        ? 'Ingreso'
                        : m.tipo === 'aportacion_hucha'
                          ? 'Ahorro (hucha)'
                          : 'Gasto'}
                    </td>
                    <td
                      className={
                        m.tipo === 'ingreso' ? 'text-pos' : m.tipo === 'aportacion_hucha' ? 'text-pos' : 'text-neg'
                      }
                    >
                      {fmt(Number(m.monto))}
                    </td>
                    <td>{m.categoria || '—'}</td>
                    <td>{m.descripcion || '—'}</td>
                    <td>
                      <button type="button" className="btn-del" onClick={() => eliminar(m.id)}>
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="fin-ia glass animate-fade-in">
          <h2 className="section-title">Informe semanal con IA (Groq)</h2>
          <p className="muted fin-ia-intro">
            Usa los movimientos guardados para la semana natural (lunes–domingo). Configura{' '}
            <code>GROQ_API_KEY</code> en el servidor:{' '}
            <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer">
              Groq Console
            </a>
            .
          </p>
          {!aiGroq && (
            <p className="fin-warn">
              IA no configurada: crea <code>GROQ_API_KEY</code> en <code>backend/server/.env</code>.
            </p>
          )}
          <div className="fin-ia-row">
            <label className="fin-ia-label">
              Lunes de la semana a analizar{' '}
              <input
                type="date"
                value={semanaInforme}
                onChange={(e) => setSemanaInforme(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="btn-primary"
              disabled={!userId || informeLoading || !aiGroq}
              onClick={generarInforme}
            >
              {informeLoading ? 'Generando informe…' : 'Generar informe semanal'}
            </button>
          </div>
          {informeMd && (
            <div className="fin-informe-md" role="article">
              {informeMd}
            </div>
          )}
        </section>

        <style>{`
          .fin-page-bg {
            position: relative;
          }
          .fin-page-bg::before {
            content: '';
            position: fixed;
            z-index: 0;
            top: 0;
            right: 0;
            bottom: 0;
            left: 0;
            pointer-events: none;
            background-color: #f5f2ee;
            background-image: linear-gradient(
                rgba(255, 253, 248, 0.2),
                rgba(245, 240, 232, 0.3)
              ),
              url('/finanzas-bg.png');
            background-size: 100% auto, 100% auto;
            background-position: center center;
            background-repeat: no-repeat;
          }
          @media (max-width: 1024px) {
            .fin-page-bg::before {
              left: 0;
            }
          }
          .fin-page-bg > .dashboard-main {
            position: relative;
            z-index: 1;
          }

          .page-head { margin-bottom: 24px; }
          .dash-sub { color: var(--color-text-muted); font-size: 0.95rem; margin-top: 6px; }
          .fin-toolbar {
            display: flex;
            flex-wrap: wrap;
            gap: 16px;
            padding: 16px 20px;
            margin-bottom: 20px;
            border-radius: 16px;
            align-items: center;
          }
          .fin-toolbar select,
          .fin-toolbar input[type='number'] {
            margin-left: 8px;
            padding: 8px 12px;
            border-radius: 10px;
            border: 1px solid var(--color-border);
            background: var(--color-bg-card);
            color: var(--color-text);
            font-family: var(--font-main);
          }
          .fin-error {
            color: var(--color-danger);
            margin-bottom: 16px;
            padding: 12px;
            border-radius: 12px;
            background: rgba(255, 107, 107, 0.1);
          }
          .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
            margin-bottom: 24px;
          }
          .stat-card {
            padding: 20px;
            border-radius: 16px;
            display: flex;
            gap: 14px;
            align-items: flex-start;
          }
          .stat-label {
            font-size: 0.75rem;
            color: var(--color-text-muted);
            text-transform: uppercase;
            letter-spacing: 0.06em;
          }
          .stat-value {
            font-size: 1.35rem;
            font-weight: 700;
            margin-top: 4px;
          }
          .text-pos { color: var(--color-success); }
          .text-neg { color: var(--color-danger); }
          .fin-chart { padding: 24px; border-radius: 16px; margin-bottom: 24px; }
          .fin-bars { display: flex; flex-direction: column; gap: 14px; margin-top: 12px; }
          .fin-bar-track {
            height: 12px;
            background: rgba(15, 23, 42, 0.06);
            border-radius: 8px;
            overflow: hidden;
            margin-top: 6px;
          }
          .fin-bar { height: 100%; border-radius: 8px; transition: width 0.4s ease; }
          .fin-bar.ing {
            background: linear-gradient(90deg, var(--color-success), var(--color-accent));
          }
          .fin-bar.gas {
            background: linear-gradient(90deg, var(--color-danger), var(--color-warning));
          }
          .fin-form-section { padding: 24px; border-radius: 16px; margin-bottom: 24px; }
          .fin-hucha-hint {
            margin-top: 14px;
            font-size: 0.88rem;
          }
          .fin-hucha-hint a {
            color: var(--color-accent-light);
            font-weight: 600;
            text-decoration: none;
          }
          .fin-hucha-hint a:hover {
            text-decoration: underline;
          }
          .fin-form {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
            gap: 12px;
            align-items: end;
            margin-top: 12px;
          }
          .fin-form select,
          .fin-form input {
            padding: 10px 14px;
            border-radius: 12px;
            border: 1px solid var(--color-border);
            background: var(--color-bg-card);
            color: var(--color-text);
            font-family: var(--font-main);
          }
          .fin-table-wrap { padding: 24px; border-radius: 16px; overflow-x: auto; }
          .fin-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.9rem;
            margin-top: 12px;
          }
          .fin-table th,
          .fin-table td {
            text-align: left;
            padding: 10px 12px;
            border-bottom: 1px solid var(--color-border);
          }
          .btn-del {
            background: transparent;
            border: 1px solid var(--color-border);
            color: var(--color-danger);
            padding: 6px 12px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 0.8rem;
          }
          .btn-del:hover { border-color: var(--color-danger); background: rgba(255,107,107,0.1); }
          .muted { color: var(--color-text-muted); }
          .section-title {
            font-size: 1.05rem;
            font-weight: 600;
            margin-bottom: 4px;
          }
          .fin-ia {
            padding: 24px;
            border-radius: 16px;
            margin-bottom: 32px;
          }
          .fin-ia-intro {
            font-size: 0.88rem;
            line-height: 1.5;
            margin: 10px 0 14px;
          }
          .fin-ia-intro a {
            color: var(--color-accent-light);
          }
          .fin-warn {
            font-size: 0.85rem;
            color: var(--color-warning);
            margin-bottom: 14px;
            padding: 10px 12px;
            border-radius: 10px;
            background: rgba(253, 203, 110, 0.08);
          }
          .fin-warn code {
            font-size: 0.78rem;
            background: rgba(15, 23, 42, 0.06);
            padding: 2px 6px;
            border-radius: 6px;
          }
          .fin-ia-row {
            display: flex;
            flex-wrap: wrap;
            gap: 16px;
            align-items: flex-end;
            margin-bottom: 12px;
          }
          .fin-ia-label input[type='date'] {
            margin-left: 8px;
            padding: 8px 12px;
            border-radius: 10px;
            border: 1px solid var(--color-border);
            background: var(--color-bg-card);
            color: var(--color-text);
            font-family: var(--font-main);
          }
          .fin-informe-md {
            margin-top: 18px;
            padding: 18px 20px;
            border-radius: 14px;
            border: 1px solid var(--color-border);
            background: #F1F5F9;
            white-space: pre-wrap;
            font-size: 0.92rem;
            line-height: 1.65;
            color: var(--color-text);
          }
        `}</style>
      </main>
    </div>
  )
}
