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
    { path: '/alimentacion', icon: '🍽️', label: 'Alimentación' },
  ]

  return (
    <>
      <aside className="sidebar glass-strong">
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">🧠</div>
          <span className="sidebar-logo-text">
            My<span className="gradient-text">BrAIn</span>
          </span>
        </div>

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
          left: 0;
          top: 0;
          bottom: 0;
          width: 260px;
          display: flex;
          flex-direction: column;
          padding: 24px 16px;
          z-index: 50;
          border-right: 1px solid var(--color-border);
          border-radius: 0;
        }

        /* Logo */
        .sidebar-logo {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 12px;
          margin-bottom: 32px;
        }
        .sidebar-logo-icon {
          font-size: 1.8rem;
          line-height: 1;
        }
        .sidebar-logo-text {
          font-size: 1.4rem;
          font-weight: 800;
          letter-spacing: -0.5px;
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
          background: rgba(108, 92, 231, 0.1);
        }
        .sidebar-link.active {
          color: white;
          background: linear-gradient(135deg, rgba(108, 92, 231, 0.3), rgba(0, 206, 201, 0.15));
          border: 1px solid rgba(108, 92, 231, 0.25);
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
          background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
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
