import { useState, useEffect } from 'react';
import api from '../utils/api';

const DEPARTMENTS = ['IT', 'Finance', 'Marketing', 'HR', 'Operations'];
const ROLES       = ['Administrator', 'Department Manager', 'Project Manager', 'User', 'Guest'];
const USERS_COLS  = '1.5fr 1.5fr 1.4fr 1fr 1fr 1fr';
const EMPTY_FORM  = { full_name: '', email: '', password: '', role_name: 'User', department: '' };

const ROLE_COLORS = {
  Administrator:        { bg: '#EDE9FE', text: '#7C3AED' },
  'Department Manager': { bg: '#DBEAFE', text: '#2563EB' },
  'Project Manager':    { bg: '#FEF3C7', text: '#D97706' },
  User:                 { bg: '#DCFCE7', text: '#16A34A' },
  Guest:                { bg: '#F1F5F9', text: '#64748B' },
};

const ROLE_HINTS = {
  Administrator:        'Full system access — can manage all users, files, and settings.',
  'Department Manager': 'Manages files and users within their assigned department.',
  'Project Manager':    'Manages project-level files and can share across departments.',
  User:                 'Standard access — upload and manage their own files.',
  Guest:                'Read-only access to files explicitly shared with them.',
};

const ACTION_COLORS = {
  LOGIN:            '#16A34A',
  FILE_UPLOAD:      '#2563EB',
  FILE_DOWNLOAD:    '#D97706',
  FILE_DELETE:      '#DC2626',
  FILE_SHARE:       '#2563EB',
  ACCESS_DENIED:    '#DC2626',
  USER_ROLE_UPDATE: '#D97706',
  USER_DEACTIVATE:  '#DC2626',
};

const PersonIcon = ({ color }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
  </svg>
);

const AdminPanel = () => {
  const [users, setUsers]             = useState([]);
  const [logs, setLogs]               = useState([]);
  const [loading, setLoading]         = useState(true);
  const [logsLoading, setLogsLoading] = useState(true);
  const [error, setError]             = useState('');
  const [success, setSuccess]         = useState('');
  const [activeTab, setActiveTab]     = useState('users');
  const [createForm, setCreateForm]   = useState(EMPTY_FORM);
  const [createLoading, setCreateLoading] = useState(false);
  const [showPassword, setShowPassword]   = useState(false);

  const fetchUsers = async () => {
    try { const res = await api.get('/users'); setUsers(res.data.users); }
    catch { setError('Failed to load users'); }
    finally { setLoading(false); }
  };

  const fetchLogs = async () => {
    try { const res = await api.get('/audit'); setLogs(res.data.logs); }
    catch { setError('Failed to load logs'); }
    finally { setLogsLoading(false); }
  };

  useEffect(() => { fetchUsers(); fetchLogs(); }, []);

  const clearMessages = () => { setError(''); setSuccess(''); };

  const handleRoleChange = async (userId, newRole) => {
    clearMessages();
    try { await api.patch(`/users/${userId}/role`, { role_name: newRole }); setSuccess('Role updated'); fetchUsers(); }
    catch { setError('Failed to update role'); }
  };

  const handleDepartmentChange = async (userId, department) => {
    clearMessages();
    try { await api.patch(`/users/${userId}/department`, { department }); setSuccess('Department updated'); fetchUsers(); }
    catch { setError('Failed to update department'); }
  };

  const handleDeactivate = async (userId) => {
    if (!window.confirm('Deactivate this user?')) return;
    clearMessages();
    try { await api.patch(`/users/${userId}/deactivate`); setSuccess('User deactivated'); fetchUsers(); }
    catch { setError('Failed to deactivate'); }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    clearMessages();
    setCreateLoading(true);
    try {
      const payload = { ...createForm, department: createForm.department || undefined };
      await api.post('/auth/register', payload);
      setSuccess(`Account created for ${createForm.email}`);
      setCreateForm(EMPTY_FORM);
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create user');
    } finally {
      setCreateLoading(false);
    }
  };

  const field = (label, children) => (
    <div>
      <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
      {children}
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '20px', fontWeight: '700', color: '#0F172A', letterSpacing: '-0.3px' }}>Admin Panel</div>
        <div style={{ fontSize: '13px', color: '#64748B', marginTop: '3px' }}>Manage users, roles, departments and audit logs</div>
      </div>

      {error   && <div className="error-box">{error}</div>}
      {success && <div className="success-box">{success}</div>}

      {/* Role summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {ROLES.map(role => {
          const { bg, text } = ROLE_COLORS[role];
          return (
            <div key={role} className="neu-raised" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <PersonIcon color={text} />
                </div>
                <span style={{ fontSize: '10px', fontWeight: '600', padding: '3px 8px', borderRadius: '20px', background: bg, color: text, textAlign: 'right', maxWidth: '110px', lineHeight: 1.3 }}>{role}</span>
              </div>
              <div style={{ fontSize: '26px', fontWeight: '700', color: '#0F172A', letterSpacing: '-0.5px' }}>
                {users.filter(u => u.role === role).length}
              </div>
              <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>Total {role}s</div>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
        {['users', 'create', 'logs'].map(tab => (
          <button
            key={tab}
            className={activeTab === tab ? 'neu-btn-primary' : 'neu-btn'}
            onClick={() => { setActiveTab(tab); clearMessages(); }}
            style={{ fontSize: '13px', padding: '9px 20px' }}
          >
            {tab === 'users' ? 'User Management' : tab === 'create' ? 'Create User' : 'Audit Logs'}
          </button>
        ))}
      </div>

      {/* Users tab */}
      {activeTab === 'users' && (
        <div className="neu-raised" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#0F172A' }}>All Users</div>
          </div>
          {loading ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>Loading…</div>
          ) : (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: USERS_COLS, gap: '8px', padding: '12px 20px', borderBottom: '1px solid #F1F5F9' }}>
                {['Name', 'Email', 'Role', 'Department', 'Status', 'Actions'].map(h => (
                  <div key={h} style={{ fontSize: '11px', fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</div>
                ))}
              </div>
              {users.map((user, idx) => (
                <div key={user.id} style={{ display: 'grid', gridTemplateColumns: USERS_COLS, gap: '8px', padding: '14px 20px', alignItems: 'center', borderBottom: idx < users.length - 1 ? '1px solid #F8FAFC' : 'none' }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#0F172A' }}>{user.full_name}</div>
                  <div style={{ fontSize: '12px', color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
                  <select className="neu-input" style={{ padding: '7px 10px', fontSize: '12px' }} value={user.role} onChange={e => handleRoleChange(user.id, e.target.value)}>
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <select className="neu-input" style={{ padding: '7px 10px', fontSize: '12px' }} value={user.department || ''} onChange={e => handleDepartmentChange(user.id, e.target.value)}>
                    <option value="">No dept</option>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <span className="badge" style={{ background: user.is_active ? '#DCFCE7' : '#FEE2E2', color: user.is_active ? '#16A34A' : '#DC2626' }}>
                    {user.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <div>
                    {user.is_active && (
                      <button className="neu-btn" style={{ padding: '6px 10px', fontSize: '11px', color: '#DC2626' }} onClick={() => handleDeactivate(user.id)}>
                        Deactivate
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create User tab */}
      {activeTab === 'create' && (
        <div className="neu-raised" style={{ padding: '0', overflow: 'hidden', maxWidth: '520px' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#0F172A' }}>Create New Account</div>
            <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>New user will be able to log in immediately</div>
          </div>
          <form onSubmit={handleCreateUser} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {field('Full Name',
              <input className="neu-input" type="text" placeholder="Jane Smith" value={createForm.full_name}
                onChange={e => setCreateForm({ ...createForm, full_name: e.target.value })} required />
            )}
            {field('Email Address',
              <input className="neu-input" type="email" placeholder="jane@company.com" value={createForm.email}
                onChange={e => setCreateForm({ ...createForm, email: e.target.value })} required />
            )}
            {field('Password',
              <div style={{ position: 'relative' }}>
                <input
                  className="neu-input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={createForm.password}
                  onChange={e => setCreateForm({ ...createForm, password: e.target.value })}
                  required minLength={8}
                  style={{ paddingRight: '44px' }}
                />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: '2px' }}>
                  {showPassword ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            )}
            {field('Role',
              <select className="neu-input" value={createForm.role_name} onChange={e => setCreateForm({ ...createForm, role_name: e.target.value })}>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            )}
            {field('Department',
              <select className="neu-input" value={createForm.department} onChange={e => setCreateForm({ ...createForm, department: e.target.value })}>
                <option value="">No department</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            )}
            <div style={{ background: '#F8FAFC', borderRadius: '10px', padding: '12px 14px', fontSize: '12px', color: '#64748B', lineHeight: 1.6 }}>
              {ROLE_HINTS[createForm.role_name]}
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
              <button className="neu-btn-primary" type="submit" disabled={createLoading} style={{ flex: 1, padding: '12px', fontSize: '14px' }}>
                {createLoading ? 'Creating…' : 'Create Account'}
              </button>
              <button className="neu-btn" type="button" onClick={() => setCreateForm(EMPTY_FORM)} style={{ padding: '12px 20px', fontSize: '14px' }}>
                Reset
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Logs tab */}
      {activeTab === 'logs' && (
        <div className="neu-raised" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #F1F5F9' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#0F172A' }}>Audit Logs</div>
            <button className="neu-btn" style={{ fontSize: '12px' }} onClick={fetchLogs}>Refresh</button>
          </div>
          {logsLoading ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>Loading logs…</div>
          ) : logs.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', fontSize: '13px', color: '#94A3B8' }}>No logs yet</div>
          ) : (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 2fr 1fr', gap: '8px', padding: '12px 20px', borderBottom: '1px solid #F1F5F9' }}>
                {['User', 'Role', 'Action', 'Details', 'Time'].map(h => (
                  <div key={h} style={{ fontSize: '11px', fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</div>
                ))}
              </div>
              {logs.map((log, idx) => {
                const color = ACTION_COLORS[log.action] || '#64748B';
                return (
                  <div key={log.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 2fr 1fr', gap: '8px', padding: '13px 20px', alignItems: 'center', borderBottom: idx < logs.length - 1 ? '1px solid #F8FAFC' : 'none' }}>
                    <div style={{ fontSize: '12px', color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.user_email || 'System'}</div>
                    <div style={{ fontSize: '11px', color: '#64748B' }}>{log.user_role || '—'}</div>
                    <div><span className="badge" style={{ background: `${color}15`, color, fontSize: '10px' }}>{log.action}</span></div>
                    <div style={{ fontSize: '11px', color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.details || '—'}</div>
                    <div style={{ fontSize: '11px', color: '#94A3B8' }}>{new Date(log.created_at).toLocaleString()}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminPanel;