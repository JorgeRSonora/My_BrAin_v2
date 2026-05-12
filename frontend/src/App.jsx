import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Finanzas from './pages/Finanzas'
import Alimentacion from './pages/Alimentacion'
import ListaCompra from './pages/ListaCompra'
import Eventos from './pages/Eventos'
import SonoraParticleHero from './components/sonora/SonoraParticleHero'

// Componente para proteger rutas
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <img
          src="/logo-mybrain.png"
          alt=""
          width={72}
          height={72}
          decoding="async"
          style={{
            width: 72,
            height: 'auto',
            maxHeight: 72,
            objectFit: 'contain',
            animation: 'pulse-glow 2s ease-in-out infinite',
          }}
        />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}

// Redirigir si ya está logueado
function PublicRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) return null

  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/finanzas"
        element={
          <ProtectedRoute>
            <Finanzas />
          </ProtectedRoute>
        }
      />
      <Route
        path="/alimentacion"
        element={
          <ProtectedRoute>
            <Alimentacion />
          </ProtectedRoute>
        }
      />
      <Route
        path="/lista-compra"
        element={
          <ProtectedRoute>
            <ListaCompra />
          </ProtectedRoute>
        }
      />
      <Route
        path="/eventos"
        element={
          <ProtectedRoute>
            <Eventos />
          </ProtectedRoute>
        }
      />
      {/* Landing marketing Sonora (3D); la app My_BrAIn entra por / → dashboard o login */}
      <Route path="/sonora" element={<SonoraParticleHero />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
