import { useState, useEffect } from 'react';
import api from '../utils/api';

const DEPARTMENTS = ['IT', 'Finance', 'Marketing', 'HR', 'Operations'];

const ROLE_COLORS = {
  Administrator: { bg: '#EDE9FE', text: '#7C3AED' },
  Manager:       { bg: '#DBEAFE', text: '#2563EB' },
  User:          { bg: '#DCFCE7', text: '#16A34A' },
  Guest:         { bg: '#F1F5F9', text: '#64748B' },
};

const ACTION_COLORS = {
  LOGIN:             '#16A34A',
  FILE_UPLOAD:       '#2563EB',
  FILE_DOWNLOAD:     '#D97706',
  FILE_DELETE:       '#DC2626',
  FILE_SHARE:        '#2563EB',
  ACCESS_DENIED:     '#DC2626',
  USER_ROLE_UPDATE:  '#D97706',
  USER_DEACTIVATE:   '#DC2626',
};

const AdminPanel = () => {
  const [users, setUsers]         = useState([]);
  const [logs, setLogs]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [logsLoading, setLogsLoading] = useState(true);
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState('');
  const [activeTab, setActiveTab] = useState('users');

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

  const handleRoleChange = async (userId, newRole) => {
    try { await api.patch(`/users/${userId}/role`, { role_name: newRole }); setSuccess('Role updated'); fetchUsers(); }
    catch { setError('Failed to update role'); }
  };

  const handleDepartmentChange = async (userId, department) => {
    try { await api.patch(`/users/${userId}/department`, { department }); setSuccess('Department updated'); fetchUsers(); }
    catch { setError('Failed to update department'); }
  };

  const handleDeactivate = async (userId) => {
    if (!window.confirm('Deactivate this user?')) return;
    try { await api.patch(`/users/${userId}/deactivate`); setSuccess('User deactivated'); fetchUsers(); }
    catch { setError('Failed to deactivate'); }
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '20px', fontWeight: '700', color: '#0F172A', letterSpacing: '-0.3px' }}>Admin Panel</div>
        <div style={{ fontSize: '13px', color: '#64748B', marginTop: '3px' }}>
          Manage users, roles, departments and audit logs
        </div>
      </div>

      {error   && <div className="error-box">{error}</div>}
      {success && <div className="success-box">{success}</div>}

      {/* Role summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {['Administrator', 'Manager', 'User', 'Guest'].map(role => {
          const { bg, text } = ROLE_COLORS[role];
          return (
            <div key={role} className="neu-raised" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={text} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                  </svg>
                </div>
                <span style={{ fontSize: '11px', fontWeight: '600', padding: '3px 10px', borderRadius: '20px', background: bg, color: text }}>
                  {role}
                </span>
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
        {['users', 'logs'].map(tab => (
          <button key={tab}
            className={activeTab === tab ? 'neu-btn-primary' : 'neu-btn'}
            onClick={() => setActiveTab(tab)}
            style={{ fontSize: '13px', padding: '9px 20px' }}>
            {tab === 'users' ? 'User Management' : 'Audit Logs'}
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
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 1fr 1fr 1fr 1fr', gap: '8px', padding: '12px 20px', borderBottom: '1px solid #F1F5F9' }}>
                {['Name','Email','Role','Department','Status','Actions'].map(h => (
                  <div key={h} style={{ fontSize: '11px', fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</div>
                ))}
              </div>

              {users.map((user, idx) => (
                <div key={user.id} style={{
                  display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 1fr 1fr 1fr 1fr',
                  gap: '8px', padding: '14px 20px', alignItems: 'center',
                  borderBottom: idx < users.length - 1 ? '1px solid #F8FAFC' : 'none',
                }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#0F172A' }}>{user.full_name}</div>
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user.email}
                  </div>
                  <select className="neu-input" style={{ padding: '7px 10px', fontSize: '12px' }}
                    value={user.role} onChange={e => handleRoleChange(user.id, e.target.value)}>
                    {['Administrator','Manager','User','Guest'].map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <select className="neu-input" style={{ padding: '7px 10px', fontSize: '12px' }}
                    value={user.department || ''} onChange={e => handleDepartmentChange(user.id, e.target.value)}>
                    <option value="">No dept</option>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <span className="badge" style={{
                    background: user.is_active ? '#DCFCE7' : '#FEE2E2',
                    color: user.is_active ? '#16A34A' : '#DC2626',
                  }}>
                    {user.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <div>
                    {user.is_active && (
                      <button className="neu-btn" style={{ padding: '6px 10px', fontSize: '11px', color: '#DC2626' }}
                        onClick={() => handleDeactivate(user.id)}>
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

      {/* Logs tab */}
      {activeTab === 'logs' && (
        <div className="neu-raised" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #F1F5F9' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#0F172A' }}>Audit Logs</div>
            <button className="neu-btn" style={{ fontSize: '12px' }} onClick={fetchLogs}>
              Refresh
            </button>
          </div>

          {logsLoading ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>Loading logs…</div>
          ) : logs.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', fontSize: '13px', color: '#94A3B8' }}>No logs yet</div>
          ) : (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 2fr 1fr', gap: '8px', padding: '12px 20px', borderBottom: '1px solid #F1F5F9' }}>
                {['User','Role','Action','Details','Time'].map(h => (
                  <div key={h} style={{ fontSize: '11px', fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</div>
                ))}
              </div>
              {logs.map((log, idx) => {
                const color = ACTION_COLORS[log.action] || '#64748B';
                return (
                  <div key={log.id} style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 2fr 1fr',
                    gap: '8px', padding: '13px 20px', alignItems: 'center',
                    borderBottom: idx < logs.length - 1 ? '1px solid #F8FAFC' : 'none',
                  }}>
                    <div style={{ fontSize: '12px', color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.user_email || 'System'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748B' }}>{log.user_role || '—'}</div>
                    <div>
                      <span className="badge" style={{ background: `${color}15`, color, fontSize: '10px' }}>
                        {log.action}
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.details || '—'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#94A3B8' }}>
                      {new Date(log.created_at).toLocaleString()}
                    </div>
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