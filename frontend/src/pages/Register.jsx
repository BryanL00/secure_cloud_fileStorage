import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../utils/api';

const Register = () => {
 const [form, setForm] = useState({
  email: '', password: '', full_name: '',
  role_name: 'User', department: ''
});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/register', form);
      setSuccess('Registered! Redirecting...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
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
          <div style={{ fontSize: '20px', fontWeight: '600', color: '#4A5568' }}>
            Create Account
          </div>
          <div style={{ fontSize: '13px', color: '#8896A5', marginTop: '4px' }}>
            Secure Cloud Storage
          </div>
        </div>

        {error && <div className="error-box">{error}</div>}
        {success && <div className="success-box">{success}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <input
            className="neu-input"
            type="text"
            placeholder="Full name"
            value={form.full_name}
            onChange={e => setForm({ ...form, full_name: e.target.value })}
            required
          />
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
          <select
            className="neu-input"
            value={form.role_name}
            onChange={e => setForm({ ...form, role_name: e.target.value })}
          >
            <option value="User">User</option>
            <option value="Manager">Manager</option>
            <option value="Guest">Guest</option>
          </select>

          <select
            className="neu-input"
            value={form.department}
            onChange={e => setForm({ ...form, department: e.target.value })}
          >
            <option value="">Select Department (optional)</option>
            <option value="IT">IT</option>
            <option value="Finance">Finance</option>
            <option value="Marketing">Marketing</option>
            <option value="HR">HR</option>
            <option value="Operations">Operations</option>
          </select>
          <button
            className="neu-btn-primary"
            type="submit"
            disabled={loading}
            style={{ marginTop: '8px', padding: '14px' }}
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '13px', color: '#8896A5' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: '#5B6EAE', textDecoration: 'none', fontWeight: '500' }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Register;