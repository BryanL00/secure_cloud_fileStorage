import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const Login = () => {
  const [form, setForm]     = useState({ email: '', password: '' });
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const { login }  = useAuth();
  const navigate   = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await api.post('/auth/login', form);
      login(res.data.user, res.data.token);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally { setLoading(false); }
  };

  return (
    <div style={{
      minHeight: '100vh', background: '#F0FDF4',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Left decorative panel */}
      <div style={{
        width: '460px', minHeight: '100vh',
        background: 'linear-gradient(160deg, #22C55E 0%, #16A34A 60%, #15803D 100%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '48px', color: '#FFFFFF',
        position: 'fixed', left: 0, top: 0,
      }}>
        <div style={{
          width: '72px', height: '72px', borderRadius: '20px',
          background: 'rgba(255,255,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: '24px',
        }}>
          <svg width="38" height="38" viewBox="0 0 24 24" fill="white">
            <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>
          </svg>
        </div>
        <div style={{ fontSize: '32px', fontWeight: '800', letterSpacing: '-0.5px', marginBottom: '12px' }}>Cloudy</div>
        <div style={{ fontSize: '15px', opacity: 0.85, textAlign: 'center', lineHeight: 1.6 }}>
          Your secure cloud storage.<br/>Access files anywhere, anytime.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '48px', width: '100%' }}>
          {['End-to-end encryption', 'Role-based access control', 'Audit log & compliance'].map(f => (
            <div key={f} style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              background: 'rgba(255,255,255,0.15)', padding: '12px 16px', borderRadius: '12px',
            }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#FFFFFF', flexShrink: 0 }}/>
              <span style={{ fontSize: '14px' }}>{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right: login form */}
      <div style={{
        marginLeft: '460px', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', padding: '48px',
      }}>
        <div style={{ width: '100%', maxWidth: '380px' }}>
          <div style={{ marginBottom: '36px' }}>
            <div style={{ fontSize: '26px', fontWeight: '800', color: '#0F172A', letterSpacing: '-0.5px' }}>
              Welcome back
            </div>
            <div style={{ fontSize: '14px', color: '#64748B', marginTop: '6px' }}>
              Sign in to your Cloudy account
            </div>
          </div>

          {error && <div className="error-box">{error}</div>}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Email address
              </label>
              <input className="neu-input" type="email" placeholder="you@example.com"
                value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Password
              </label>
              <input className="neu-input" type="password" placeholder="••••••••"
                value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
            </div>
            <button className="neu-btn-primary" type="submit" disabled={loading}
              style={{ marginTop: '8px', padding: '13px', fontSize: '15px' }}>
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '13px', color: '#64748B' }}>
            No account?{' '}
            <Link to="/register" style={{ color: '#22C55E', textDecoration: 'none', fontWeight: '600' }}>
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;