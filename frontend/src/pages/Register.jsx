import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../utils/api';

const Register = () => {
  const [form, setForm]       = useState({ email: '', password: '', full_name: '', role_name: 'User', department: '' });
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await api.post('/auth/register', form);
      setSuccess('Registered! Redirecting…');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* Left decorative panel */}
      <div style={{
        width: '460px', minHeight: '100vh',
        background: 'linear-gradient(160deg, #22C55E 0%, #16A34A 60%, #15803D 100%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '48px', color: '#FFFFFF', position: 'fixed', left: 0, top: 0,
      }}>
        <div style={{ width: '72px', height: '72px', borderRadius: '20px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
          <svg width="38" height="38" viewBox="0 0 24 24" fill="white">
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
          </svg>
        </div>
        <div style={{ fontSize: '32px', fontWeight: '800', letterSpacing: '-0.5px', marginBottom: '12px' }}>CloudFortify</div>
        <div style={{ fontSize: '15px', opacity: 0.85, textAlign: 'center', lineHeight: 1.6 }}>
          Join your team&apos;s secure fortress.<br/>Collaborate with confidence.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '48px', width: '100%' }}>
          {['End-to-end encryption', 'Role-based access control', 'Audit log & compliance'].map(f => (
            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.15)', padding: '12px 16px', borderRadius: '12px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#FFFFFF', flexShrink: 0 }}/>
              <span style={{ fontSize: '14px' }}>{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right: register form */}
      <div style={{ marginLeft: '460px', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '48px' }}>
        <div style={{ width: '100%', maxWidth: '380px' }}>
          <div style={{ marginBottom: '32px' }}>
            <div style={{ fontSize: '26px', fontWeight: '800', color: '#0F172A', letterSpacing: '-0.5px' }}>Create account</div>
            <div style={{ fontSize: '14px', color: '#64748B', marginTop: '6px' }}>Get started with CloudFortify today</div>
          </div>
          {error   && <div className="error-box">{error}</div>}
          {success && <div className="success-box">{success}</div>}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {[
              { label: 'Full name',     type: 'text',     key: 'full_name', placeholder: 'Jane Doe' },
              { label: 'Email address', type: 'email',    key: 'email',     placeholder: 'you@example.com' },
              { label: 'Password',      type: 'password', key: 'password',  placeholder: '••••••••' },
            ].map(({ label, type, key, placeholder }) => (
              <div key={key}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
                <input className="neu-input" type={type} placeholder={placeholder} required value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} />
              </div>
            ))}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Role</label>
              <select className="neu-input" value={form.role_name} onChange={e => setForm({ ...form, role_name: e.target.value })}>
                <option value="User">User</option>
                <option value="Manager">Manager</option>
                <option value="Guest">Guest</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Department <span style={{ fontWeight: '400', textTransform: 'none', color: '#94A3B8' }}>(optional)</span>
              </label>
              <select className="neu-input" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })}>
                <option value="">Select department</option>
                {['IT','Finance','Marketing','HR','Operations'].map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <button className="neu-btn-primary" type="submit" disabled={loading} style={{ marginTop: '8px', padding: '13px', fontSize: '15px' }}>
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>
          <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '13px', color: '#64748B' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: '#22C55E', textDecoration: 'none', fontWeight: '600' }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;