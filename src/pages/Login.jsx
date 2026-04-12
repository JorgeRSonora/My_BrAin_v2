import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const [isRegister, setIsRegister] = useState(false)
  const [formData, setFormData] = useState({ username: '', nombre: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const { login, register } = useAuth()
  const navigate = useNavigate()

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      if (isRegister) {
        await register(formData.username, formData.nombre, formData.email, formData.password)
      } else {
        await login(formData.username, formData.password)
      }
      navigate('/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const toggleMode = () => {
    setIsRegister(!isRegister)
    setError('')
    setFormData({ username: '', nombre: '', email: '', password: '' })
  }

  return (
    <div className="login-page">
      {/* Fondo con partículas decorativas */}
      <div className="login-bg">
        <div className="bg-orb bg-orb-1"></div>
        <div className="bg-orb bg-orb-2"></div>
        <div className="bg-orb bg-orb-3"></div>
      </div>

      <div className="login-container animate-fade-in">
        {/* Logo y título */}
        <div className="login-header">
          <div className="login-logo">
            <span className="logo-icon">🧠</span>
          </div>
          <h1 className="login-title">
            My<span className="gradient-text">BrAIn</span>
          </h1>
          <p className="login-subtitle">Tu segundo cerebro</p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="username">Usuario</label>
            <input
              type="text"
              id="username"
              name="username"
              placeholder="Tu usuario"
              value={formData.username}
              onChange={handleChange}
              autoComplete="username"
              required
            />
          </div>

          {isRegister && (
            <>
              <div className="form-group animate-fade-in">
                <label htmlFor="nombre">Nombre</label>
                <input
                  type="text"
                  id="nombre"
                  name="nombre"
                  placeholder="Tu nombre"
                  value={formData.nombre}
                  onChange={handleChange}
                  autoComplete="name"
                  required
                />
              </div>
              <div className="form-group animate-fade-in">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  placeholder="tu@email.com"
                  value={formData.email}
                  onChange={handleChange}
                  autoComplete="email"
                  required
                />
              </div>
            </>
          )}

          <div className="form-group">
            <label htmlFor="password">Contraseña</label>
            <input
              type="password"
              id="password"
              name="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={handleChange}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              required
            />
          </div>

          {error && (
            <div className="form-error animate-fade-in">
              <span>⚠️</span> {error}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary login-btn"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="btn-loader">⏳</span>
            ) : (
              isRegister ? 'Crear cuenta' : 'Entrar'
            )}
          </button>
        </form>

        {/* Toggle login/register */}
        <div className="login-toggle">
          <p>
            {isRegister ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?'}
            <button
              type="button"
              onClick={toggleMode}
              className="toggle-btn"
            >
              {isRegister ? 'Inicia sesión' : 'Regístrate'}
            </button>
          </p>
        </div>
      </div>

      <style>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          padding: 20px;
        }

        /* Orbes de fondo */
        .login-bg {
          position: fixed;
          inset: 0;
          z-index: 0;
          pointer-events: none;
        }
        .bg-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.3;
        }
        .bg-orb-1 {
          width: 400px;
          height: 400px;
          background: var(--color-primary);
          top: -100px;
          right: -100px;
          animation: float 8s ease-in-out infinite;
        }
        .bg-orb-2 {
          width: 300px;
          height: 300px;
          background: var(--color-accent);
          bottom: -50px;
          left: -80px;
          animation: float 10s ease-in-out infinite reverse;
        }
        .bg-orb-3 {
          width: 200px;
          height: 200px;
          background: var(--color-primary-light);
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          animation: float 6s ease-in-out infinite;
        }

        /* Contenedor principal */
        .login-container {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 420px;
          padding: 40px;
          border-radius: 24px;
          background: rgba(26, 26, 46, 0.8);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(108, 92, 231, 0.2);
          box-shadow: 0 25px 60px rgba(0, 0, 0, 0.5);
        }

        /* Header */
        .login-header {
          text-align: center;
          margin-bottom: 32px;
        }
        .login-logo {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 72px;
          height: 72px;
          border-radius: 20px;
          background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
          margin-bottom: 16px;
          animation: pulse-glow 3s ease-in-out infinite;
        }
        .logo-icon {
          font-size: 36px;
          line-height: 1;
        }
        .login-title {
          font-size: 2rem;
          font-weight: 800;
          letter-spacing: -0.5px;
          color: var(--color-text);
        }
        .login-subtitle {
          color: var(--color-text-muted);
          font-size: 0.9rem;
          margin-top: 4px;
        }

        /* Formulario */
        .login-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .form-group label {
          font-size: 0.85rem;
          font-weight: 500;
          color: var(--color-text-muted);
        }
        .form-group input {
          padding: 12px 16px;
          border-radius: 12px;
          border: 1px solid var(--color-border);
          background: rgba(15, 15, 26, 0.6);
          color: var(--color-text);
          font-size: 0.95rem;
          font-family: var(--font-main);
          transition: all 0.3s ease;
          outline: none;
        }
        .form-group input::placeholder {
          color: rgba(136, 136, 160, 0.5);
        }
        .form-group input:focus {
          border-color: var(--color-primary);
          box-shadow: 0 0 0 3px rgba(108, 92, 231, 0.15);
        }

        /* Error */
        .form-error {
          padding: 10px 14px;
          border-radius: 10px;
          background: rgba(255, 107, 107, 0.1);
          border: 1px solid rgba(255, 107, 107, 0.3);
          color: var(--color-danger);
          font-size: 0.85rem;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        /* Botón */
        .login-btn {
          width: 100%;
          padding: 14px;
          font-size: 1rem;
          margin-top: 4px;
        }
        .btn-loader {
          animation: float 1s ease-in-out infinite;
          display: inline-block;
        }

        /* Toggle */
        .login-toggle {
          text-align: center;
          margin-top: 24px;
        }
        .login-toggle p {
          color: var(--color-text-muted);
          font-size: 0.85rem;
        }
        .toggle-btn {
          background: none;
          border: none;
          color: var(--color-primary-light);
          font-weight: 600;
          cursor: pointer;
          margin-left: 6px;
          font-family: var(--font-main);
          font-size: 0.85rem;
          transition: color 0.2s;
        }
        .toggle-btn:hover {
          color: var(--color-accent);
        }

        /* Responsive */
        @media (max-width: 480px) {
          .login-container {
            padding: 28px 24px;
          }
          .login-title {
            font-size: 1.6rem;
          }
        }
      `}</style>
    </div>
  )
}
