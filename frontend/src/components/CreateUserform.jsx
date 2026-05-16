// src/components/CreateUserForm.jsx
import { useState } from 'react';
import api from '../utils/api';

const ROLES = ['Administrator', 'Department Manager', 'Project Manager', 'User', 'Guest'];
const DEPARTMENTS = ['IT', 'Finance', 'Marketing', 'HR', 'Operations'];
const EMPTY = { full_name: '', email: '', password: '', role_name: 'User', department: '' };

const CreateUserForm = ({ onSuccess }) => {
  const [form, setForm]       = useState(EMPTY);
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = { ...form, department: form.department || undefined };
      await api.post('/auth/register', payload);
      setForm(EMPTY);
      onSuccess(`Account created for ${form.email}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create user');
    } finally { setLoading(false); }
  };

  const field = (label, children) => (
    <div>
      <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
      {children}
    </div>
  );

  return (
    <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {error && <div className="error-box">{error}</div>}
      {field('Full Name',
        <input className="neu-input" type="text" placeholder="Jane Smith" value={form.full_name}
          onChange={e => setForm({ ...form, full_name: e.target.value })} required />
      )}
      {field('Email Address',
        <input className="neu-input" type="email" placeholder="jane@company.com" value={form.email}
          onChange={e => setForm({ ...form, email: e.target.value })} required />
      )}
      {field('Password',
        <input className="neu-input" type="password" placeholder="••••••••" value={form.password}
          onChange={e => setForm({ ...form, password: e.target.value })} required minLength={8} />
      )}
      {field('Role',
        <select className="neu-input" value={form.role_name} onChange={e => setForm({ ...form, role_name: e.target.value })}>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      )}
      {field('Department',
        <select className="neu-input" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })}>
          <option value="">No department</option>
          {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      )}
      <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
        <button className="neu-btn-primary" type="submit" disabled={loading} style={{ flex: 1, padding: '12px', fontSize: '14px' }}>
          {loading ? 'Creating…' : 'Create Account'}
        </button>
        <button className="neu-btn" type="button" onClick={() => setForm(EMPTY)} style={{ padding: '12px 20px', fontSize: '14px' }}>
          Reset
        </button>
      </div>
    </form>
  );
};

export default CreateUserForm;