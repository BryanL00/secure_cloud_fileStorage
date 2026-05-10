import { useState, useEffect } from 'react';
import api from '../utils/api';

const DEPARTMENTS = ['IT', 'Finance', 'Marketing', 'HR', 'Operations'];

const AdminPanel = () => {
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('users');

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      setUsers(res.data.users);
    } catch (err) {
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await api.get('/audit');
      setLogs(res.data.logs);
    } catch (err) {
      setError('Failed to load logs');
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchLogs();
  }, []);

  const handleRoleChange = async (userId, newRole) => {
    try {
      await api.patch(`/users/${userId}/role`, { role_name: newRole });
      setSuccess('Role updated');
      fetchUsers();
    } catch (err) {
      setError('Failed to update role');
    }
  };

  const handleDepartmentChange = async (userId, department) => {
    try {
      await api.patch(`/users/${userId}/department`, { department });
      setSuccess('Department updated');
      fetchUsers();
    } catch (err) {
      setError('Failed to update department');
    }
  };

  const handleDeactivate = async (userId) => {
    if (!window.confirm('Deactivate this user?')) return;
    try {
      await api.patch(`/users/${userId}/deactivate`);
      setSuccess('User deactivated');
      fetchUsers();
    } catch (err) {
      setError('Failed to deactivate');
    }
  };

  const getActionColor = (action) => {
    const colors = {
      LOGIN: '#3B7A57',
      FILE_UPLOAD: '#5B6EAE',
      FILE_DOWNLOAD: '#7A6020',
      FILE_DELETE: '#7A3020',
      FILE_SHARE: '#5B6EAE',
      ACCESS_DENIED: '#A05070',
      USER_ROLE_UPDATE: '#7A4020',
      USER_DEACTIVATE: '#7A3020'
    };
    return colors[action] || '#8896A5';
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '20px', fontWeight: '600', color: '#4A5568' }}>Admin Panel</div>
        <div style={{ fontSize: '13px', color: '#8896A5', marginTop: '2px' }}>
          Manage users, roles, departments and audit logs
        </div>
      </div>

      {error && <div className="error-box">{error}</div>}
      {success && <div className="success-box">{success}</div>}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px', marginBottom: '24px' }}>
        {['Administrator', 'Manager', 'User', 'Guest'].map(role => (
          <div key={role} className="neu-raised" style={{ padding: '20px' }}>
            <div style={{ fontSize: '11px', color: '#8896A5', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {role}s
            </div>
            <div style={{ fontSize: '22px', fontWeight: '600', color: '#5B6EAE' }}>
              {users.filter(u => u.role === role).length}
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          className={activeTab === 'users' ? 'neu-btn-primary' : 'neu-btn'}
          onClick={() => setActiveTab('users')}
          style={{ fontSize: '13px' }}
        >
          User Management
        </button>
        <button
          className={activeTab === 'logs' ? 'neu-btn-primary' : 'neu-btn'}
          onClick={() => setActiveTab('logs')}
          style={{ fontSize: '13px' }}
        >
          Audit Logs
        </button>
      </div>

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="neu-raised" style={{ padding: '24px' }}>
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#4A5568', marginBottom: '20px' }}>
            All Users
          </div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#8896A5' }}>Loading...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 1fr 1fr 1fr 1fr', gap: '8px', padding: '8px 16px' }}>
                {['Name', 'Email', 'Role', 'Department', 'Status', 'Actions'].map(h => (
                  <div key={h} style={{ fontSize: '11px', fontWeight: '600', color: '#8896A5', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</div>
                ))}
              </div>
              {users.map(user => (
                <div key={user.id} className="neu-raised" style={{
                  display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 1fr 1fr 1fr 1fr',
                  gap: '8px', padding: '14px 16px', alignItems: 'center'
                }}>
                  <div style={{ fontSize: '13px', fontWeight: '500', color: '#4A5568' }}>{user.full_name}</div>
                  <div style={{ fontSize: '12px', color: '#8896A5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
                  <select
                    className="neu-input"
                    style={{ padding: '7px 10px', fontSize: '12px' }}
                    value={user.role}
                    onChange={e => handleRoleChange(user.id, e.target.value)}
                  >
                    <option value="Administrator">Administrator</option>
                    <option value="Manager">Manager</option>
                    <option value="User">User</option>
                    <option value="Guest">Guest</option>
                  </select>
                  <select
                    className="neu-input"
                    style={{ padding: '7px 10px', fontSize: '12px' }}
                    value={user.department || ''}
                    onChange={e => handleDepartmentChange(user.id, e.target.value)}
                  >
                    <option value="">No dept</option>
                    {DEPARTMENTS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  <span className="badge" style={{
                    background: user.is_active ? '#D4EDE1' : '#F0C8C0',
                    color: user.is_active ? '#3B7A57' : '#7A3020'
                  }}>
                    {user.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <div>
                    {user.is_active && (
                      <button className="neu-btn" style={{ padding: '6px 10px', fontSize: '11px', color: '#A05070' }}
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

      {/* Logs Tab */}
      {activeTab === 'logs' && (
        <div className="neu-raised" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#4A5568' }}>Audit Logs</div>
            <button className="neu-btn" style={{ fontSize: '12px' }} onClick={fetchLogs}>
              Refresh
            </button>
          </div>
          {logsLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#8896A5' }}>Loading logs...</div>
          ) : logs.length === 0 ? (
            <div className="neu-pressed" style={{ padding: '40px', textAlign: 'center', borderRadius: '12px' }}>
              <div style={{ fontSize: '13px', color: '#8896A5' }}>No logs yet</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 2fr 1fr', gap: '8px', padding: '8px 16px' }}>
                {['User', 'Role', 'Action', 'Details', 'Time'].map(h => (
                  <div key={h} style={{ fontSize: '11px', fontWeight: '600', color: '#8896A5', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</div>
                ))}
              </div>
              {logs.map(log => (
                <div key={log.id} className="neu-raised" style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 2fr 1fr',
                  gap: '8px', padding: '12px 16px', alignItems: 'center'
                }}>
                  <div style={{ fontSize: '12px', color: '#4A5568', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {log.user_email || 'System'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#8896A5' }}>{log.user_role || '—'}</div>
                  <div>
                    <span className="badge" style={{
                      background: `${getActionColor(log.action)}20`,
                      color: getActionColor(log.action),
                      fontSize: '10px'
                    }}>
                      {log.action}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#8896A5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {log.details || '—'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#8896A5' }}>
                    {new Date(log.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminPanel;