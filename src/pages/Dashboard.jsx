import { useAuth } from '../context/AuthContext'
import Sidebar from '../components/Sidebar'

export default function Dashboard() {
  const { user } = useAuth()

  // Datos de ejemplo para las tarjetas (luego vendrán de la BD)
  const stats = [
    {
      titulo: 'Balance Total',
      valor: '€2,450.00',
      cambio: '+12.5%',
      positivo: true,
      icono: '💰',
    },
    {
      titulo: 'Gastos del Mes',
      valor: '€890.30',
      cambio: '-8.2%',
      positivo: true,
      icono: '📉',
    },
    {
      titulo: 'Ahorro Mensual',
      valor: '€560.00',
      cambio: '+22.8%',
      positivo: true,
      icono: '🏦',
    },
    {
      titulo: 'Menús Generados',
      valor: '3',
      cambio: 'esta semana',
      positivo: null,
      icono: '🍽️',
    },
  ]

  // Hora del día para el saludo
  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Buenos días'
    if (hour < 20) return 'Buenas tardes'
    return 'Buenas noches'
  }

  return (
    <div className="dashboard-layout">
      <Sidebar />

      <main className="dashboard-main">
        {/* Header del dashboard */}
        <header className="dash-header animate-fade-in">
          <div>
            <h1 className="dash-greeting">
              {getGreeting()}, <span className="gradient-text">{user?.nombre || 'Usuario'}</span>
            </h1>
            <p className="dash-date">
              {new Date().toLocaleDateString('es-ES', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
        </header>

        {/* Tarjetas de estadísticas */}
        <section className="stats-grid">
          {stats.map((stat, i) => (
            <div
              key={i}
              className="stat-card glass animate-fade-in"
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <div className="stat-icon">{stat.icono}</div>
              <div className="stat-info">
                <p className="stat-label">{stat.titulo}</p>
                <p className="stat-value">{stat.valor}</p>
                {stat.cambio && (
                  <span className={`stat-change ${stat.positivo ? 'positive' : stat.positivo === false ? 'negative' : 'neutral'}`}>
                    {stat.cambio}
                  </span>
                )}
              </div>
            </div>
          ))}
        </section>

        {/* Sección de accesos rápidos */}
        <section className="quick-actions animate-fade-in" style={{ animationDelay: '0.4s' }}>
          <h2 className="section-title">Acciones rápidas</h2>
          <div className="actions-grid">
            <button className="action-card glass" id="btn-add-income">
              <span className="action-icon">➕</span>
              <span className="action-label">Añadir Ingreso</span>
            </button>
            <button className="action-card glass" id="btn-add-expense">
              <span className="action-icon">➖</span>
              <span className="action-label">Añadir Gasto</span>
            </button>
            <button className="action-card glass" id="btn-generate-menu">
              <span className="action-icon">🤖</span>
              <span className="action-label">Generar Menú</span>
            </button>
            <button className="action-card glass" id="btn-shopping-list">
              <span className="action-icon">🛒</span>
              <span className="action-label">Lista Compra</span>
            </button>
          </div>
        </section>

        {/* Paneles inferiores: Resumen Financiero + Menú del día */}
        <section className="panels-grid animate-fade-in" style={{ animationDelay: '0.5s' }}>
          {/* Panel Finanzas */}
          <div className="panel glass">
            <div className="panel-header">
              <h3>📊 Resumen Financiero</h3>
              <span className="panel-badge">IA</span>
            </div>
            <div className="panel-content">
              <div className="finance-placeholder">
                <div className="chart-bar" style={{ height: '60%' }}><span>Ene</span></div>
                <div className="chart-bar" style={{ height: '45%' }}><span>Feb</span></div>
                <div className="chart-bar" style={{ height: '75%' }}><span>Mar</span></div>
                <div className="chart-bar active" style={{ height: '55%' }}><span>Abr</span></div>
              </div>
              <p className="panel-note">Conecta el backend para ver datos reales</p>
            </div>
          </div>

          {/* Panel Menú del día */}
          <div className="panel glass">
            <div className="panel-header">
              <h3>🍽️ Menú de Hoy</h3>
              <span className="panel-badge">IA</span>
            </div>
            <div className="panel-content">
              <div className="menu-item">
                <span className="menu-time">🌅 Comida</span>
                <p className="menu-dish">Pulsa "Generar Menú" para empezar</p>
              </div>
              <div className="menu-divider"></div>
              <div className="menu-item">
                <span className="menu-time">🌙 Cena</span>
                <p className="menu-dish">La IA diseñará tu semana completa</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <style>{`
        .dashboard-layout {
          display: flex;
          min-height: 100vh;
        }
        .dashboard-main {
          flex: 1;
          padding: 32px;
          margin-left: 260px;
          max-width: 1200px;
        }

        /* Header */
        .dash-header {
          margin-bottom: 32px;
        }
        .dash-greeting {
          font-size: 1.8rem;
          font-weight: 700;
        }
        .dash-date {
          color: var(--color-text-muted);
          font-size: 0.9rem;
          margin-top: 4px;
          text-transform: capitalize;
        }

        /* Stats Grid */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 20px;
          margin-bottom: 32px;
        }
        .stat-card {
          padding: 24px;
          border-radius: 16px;
          display: flex;
          align-items: flex-start;
          gap: 16px;
          transition: all 0.3s ease;
          cursor: default;
        }
        .stat-card:hover {
          transform: translateY(-4px);
          border-color: rgba(108, 92, 231, 0.3);
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.3);
        }
        .stat-icon {
          font-size: 2rem;
          line-height: 1;
        }
        .stat-info {
          flex: 1;
        }
        .stat-label {
          font-size: 0.8rem;
          color: var(--color-text-muted);
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .stat-value {
          font-size: 1.5rem;
          font-weight: 700;
          margin-top: 4px;
        }
        .stat-change {
          font-size: 0.78rem;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 6px;
          display: inline-block;
          margin-top: 6px;
        }
        .stat-change.positive {
          color: var(--color-success);
          background: rgba(0, 184, 148, 0.1);
        }
        .stat-change.negative {
          color: var(--color-danger);
          background: rgba(255, 107, 107, 0.1);
        }
        .stat-change.neutral {
          color: var(--color-text-muted);
          background: rgba(136, 136, 160, 0.1);
        }

        /* Quick Actions */
        .section-title {
          font-size: 1.1rem;
          font-weight: 600;
          margin-bottom: 16px;
          color: var(--color-text);
        }
        .actions-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 14px;
          margin-bottom: 32px;
        }
        .action-card {
          padding: 20px;
          border-radius: 14px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          transition: all 0.3s ease;
          font-family: var(--font-main);
          color: var(--color-text);
        }
        .action-card:hover {
          transform: translateY(-3px);
          border-color: var(--color-primary);
          box-shadow: 0 8px 25px rgba(108, 92, 231, 0.2);
        }
        .action-icon {
          font-size: 1.6rem;
        }
        .action-label {
          font-size: 0.85rem;
          font-weight: 500;
        }

        /* Panels */
        .panels-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }
        .panel {
          padding: 24px;
          border-radius: 16px;
        }
        .panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
        }
        .panel-header h3 {
          font-size: 1rem;
          font-weight: 600;
        }
        .panel-badge {
          font-size: 0.7rem;
          font-weight: 700;
          padding: 3px 10px;
          border-radius: 20px;
          background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
          color: white;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .panel-note {
          text-align: center;
          color: var(--color-text-muted);
          font-size: 0.8rem;
          margin-top: 12px;
        }

        /* Mini chart placeholder */
        .finance-placeholder {
          display: flex;
          align-items: flex-end;
          justify-content: center;
          gap: 16px;
          height: 120px;
          padding: 0 10px;
        }
        .chart-bar {
          flex: 1;
          max-width: 50px;
          background: rgba(108, 92, 231, 0.2);
          border-radius: 8px 8px 0 0;
          position: relative;
          transition: all 0.3s ease;
          display: flex;
          align-items: flex-end;
          justify-content: center;
        }
        .chart-bar:hover {
          background: rgba(108, 92, 231, 0.4);
        }
        .chart-bar.active {
          background: linear-gradient(to top, var(--color-primary), var(--color-primary-light));
        }
        .chart-bar span {
          position: absolute;
          bottom: -22px;
          font-size: 0.7rem;
          color: var(--color-text-muted);
        }

        /* Menu items */
        .menu-item {
          padding: 12px 0;
        }
        .menu-time {
          font-size: 0.8rem;
          color: var(--color-primary-light);
          font-weight: 600;
        }
        .menu-dish {
          margin-top: 4px;
          color: var(--color-text-muted);
          font-size: 0.9rem;
        }
        .menu-divider {
          height: 1px;
          background: var(--color-border);
        }

        /* Responsive */
        @media (max-width: 1024px) {
          .dashboard-main {
            margin-left: 0;
            padding: 20px;
            padding-top: 80px;
          }
          .panels-grid {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 640px) {
          .stats-grid {
            grid-template-columns: 1fr 1fr;
          }
          .dash-greeting {
            font-size: 1.4rem;
          }
        }
      `}</style>
    </div>
  )
}
