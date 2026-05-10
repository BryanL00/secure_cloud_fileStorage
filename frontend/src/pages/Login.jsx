import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const Login = () => {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/auth/login', form);
      login(res.data.user, res.data.token);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', background: '#E0E5EC',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div className="neu-raised" style={{ padding: '40px', width: '380px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '50%',
            background: '#E0E5EC', margin: '0 auto 16px',
            boxShadow: '6px 6px 12px #b8bec7, -6px -6px 12px #ffffff',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#5B6EAE" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
            </svg>
          </div>
          <div style={{ fontSize: '20px', fontWeight: '600', color: '#4A5568' }}>
            Secure Cloud Storage
          </div>
          <div style={{ fontSize: '13px', color: '#8896A5', marginTop: '4px' }}>
            Sign in to your account
          </div>
        </div>

        {error && <div className="error-box">{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <input
            className="neu-input"
            type="email"
            placeholder="Email address"
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
            required
          />
          <input
            className="neu-input"
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={e => setForm({ ...form, password: e.target.value })}
            required
          />
          <button
            className="neu-btn-primary"
            type="submit"
            disabled={loading}
            style={{ marginTop: '8px', padding: '14px' }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '13px', color: '#8896A5' }}>
          No account?{' '}
          <Link to="/register" style={{ color: '#5B6EAE', textDecoration: 'none', fontWeight: '500' }}>
            Register
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;