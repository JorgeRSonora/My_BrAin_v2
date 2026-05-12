import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const menuItems = [
    { path: '/dashboard', icon: '🏠', label: 'Dashboard' },
    { path: '/finanzas', icon: '💰', label: 'Finanzas' },
    { path: '/eventos', icon: '📅', label: 'Eventos' },
    { path: '/alimentacion', icon: '🍽️', label: 'Alimentación' },
    { path: '/lista-compra', icon: '🛒', label: 'Lista de la compra' },
  ]

  return (
    <>
      <aside className="sidebar glass">
        {/* Logo */}
        <NavLink to="/dashboard" className="sidebar-logo-link" title="Ir al inicio">
          <img
            src="/logo-mybrain.png"
            alt="MybrAIn"
            className="sidebar-logo-img"
            width={1024}
            height={559}
            decoding="async"
          />
        </NavLink>

        {/* Navegación */}
        <nav className="sidebar-nav">
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'active' : ''}`
              }
            >
              <span className="sidebar-link-icon">{item.icon}</span>
              <span className="sidebar-link-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Perfil y logout */}
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">
              {user?.nombre?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="sidebar-user-info">
              <p className="sidebar-user-name">{user?.nombre || 'Usuario'}</p>
              <p className="sidebar-user-email">{user?.email || ''}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="sidebar-logout"
            title="Cerrar sesión"
          >
            🚪
          </button>
        </div>
      </aside>

      <style>{`
        .sidebar {
          position: fixed;
          left: var(--sidebar-inset);
          top: var(--sidebar-inset);
          bottom: var(--sidebar-inset);
          width: var(--sidebar-width);
          display: flex;
          flex-direction: column;
          padding: 22px 16px;
          z-index: 50;
          border-radius: 18px;
          box-sizing: border-box;
        }

        /* Logo */
        .sidebar-logo-link {
          display: block;
          padding: 4px 8px;
          margin-bottom: 28px;
          text-decoration: none;
          border-radius: 12px;
          transition: opacity 0.2s ease;
        }
        .sidebar-logo-link:hover {
          opacity: 0.88;
        }
        .sidebar-logo-img {
          width: 100%;
          max-width: 200px;
          height: auto;
          max-height: 52px;
          object-fit: contain;
          object-position: left center;
          display: block;
        }

        /* Nav */
        .sidebar-nav {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .sidebar-link {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          border-radius: 12px;
          color: var(--color-text-muted);
          text-decoration: none;
          font-size: 0.9rem;
          font-weight: 500;
          transition: all 0.2s ease;
        }
        .sidebar-link:hover {
          color: var(--color-text);
          background: rgba(0, 0, 0, 0.05);
        }
        .sidebar-link.active {
          color: var(--color-text);
          background: rgba(0, 0, 0, 0.07);
          border: 1px solid rgba(0, 0, 0, 0.08);
          font-weight: 600;
        }
        .sidebar-link-icon {
          font-size: 1.2rem;
          line-height: 1;
        }

        /* Footer */
        .sidebar-footer {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 16px 8px;
          border-top: 1px solid var(--color-border);
          margin-top: 16px;
        }
        .sidebar-user {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }
        .sidebar-avatar {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: var(--color-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 0.9rem;
          color: white;
          flex-shrink: 0;
        }
        .sidebar-user-info {
          min-width: 0;
        }
        .sidebar-user-name {
          font-size: 0.85rem;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .sidebar-user-email {
          font-size: 0.72rem;
          color: var(--color-text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .sidebar-logout {
          background: none;
          border: none;
          font-size: 1.2rem;
          cursor: pointer;
          padding: 8px;
          border-radius: 8px;
          transition: all 0.2s;
          line-height: 1;
        }
        .sidebar-logout:hover {
          background: rgba(255, 107, 107, 0.15);
        }

        /* Responsive: ocultar sidebar en móvil (ya se maneja con margin-left) */
        @media (max-width: 1024px) {
          .sidebar {
            display: none;
          }
        }
      `}</style>
    </>
  )
}
