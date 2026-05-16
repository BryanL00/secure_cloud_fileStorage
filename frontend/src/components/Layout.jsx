import { useState, useEffect, useRef, useCallback } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const SIDEBAR_WIDTH = 240;

const IconDashboard = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
    <rect x="3" y="3" width="8" height="8" rx="1.5"/>
    <rect x="13" y="3" width="8" height="8" rx="1.5"/>
    <rect x="3" y="13" width="8" height="8" rx="1.5"/>
    <rect x="13" y="13" width="8" height="8" rx="1.5"/>
  </svg>
);

const IconFiles = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
  </svg>
);

const IconAdmin = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
  </svg>
);

const IconShared = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
  </svg>
);

const IconVault = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    <circle cx="12" cy="16" r="1"/>
  </svg>
);

const IconShield = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

const IconSearch = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);

const IconBell = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);

const IconHelp = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

const IconInvite = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
    <circle cx="8.5" cy="7" r="4"/>
    <line x1="20" y1="8" x2="20" y2="14"/>
    <line x1="23" y1="11" x2="17" y2="11"/>
  </svg>
);

const IconFile = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
  </svg>
);

const SENSITIVITY_COLORS = {
  low:          { bg: '#DCFCE7', text: '#16A34A' },
  medium:       { bg: '#FEF3C7', text: '#D97706' },
  high:         { bg: '#FEE2E2', text: '#DC2626' },
  confidential: { bg: '#EDE9FE', text: '#7C3AED' },
};

const NavItem = ({ label, icon, isActive, onClick }) => (
  <div
    onClick={onClick}
    style={{
      padding: '10px 12px', borderRadius: '8px',
      display: 'flex', alignItems: 'center', gap: '10px',
      color: isActive ? '#16A34A' : '#64748B',
      background: isActive ? '#F0FDF4' : 'transparent',
      fontWeight: isActive ? '600' : '400',
      fontSize: '14px',
      cursor: onClick ? 'pointer' : 'default',
      transition: 'background 0.15s ease, color 0.15s ease',
      userSelect: 'none',
    }}
    onMouseEnter={e => { if (!isActive && onClick) e.currentTarget.style.background = '#F8FAFC'; }}
    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
  >
    {icon}
    {label}
  </div>
);

const fmt = (bytes) => {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

const Layout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [storage, setStorage] = useState({ used_bytes: 0, shared_bytes: 0, file_count: 0, total_bytes: 10 * 1024 * 1024 * 1024 });

  useEffect(() => {
  if (user?.role === 'Administrator') return;
  api.get('/files/storage').then(res => setStorage(res.data)).catch(() => {});
  }, [user]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef(null);
  const debounceRef = useRef(null);

  const handleLogout = () => { logout(); navigate('/login'); };

  const initials = user?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';

  const performSearch = useCallback(async (q) => {
    if (!q.trim() || user?.role === 'Administrator') {
      setSearchResults([]); setShowDropdown(false); return;
    }
    setSearchLoading(true);
    try {
      const res = await api.get(`/files/search?q=${encodeURIComponent(q)}`);
      setSearchResults(res.data.files || []);
      setShowDropdown(true);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, [user]);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    clearTimeout(debounceRef.current);
    if (!val.trim()) { setSearchResults([]); setShowDropdown(false); return; }
    debounceRef.current = setTimeout(() => performSearch(val), 300);
  };

  const handleDownload = async (fileId, fileName) => {
    try {
      const res = await api.get(`/files/download/${fileId}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url; link.setAttribute('download', fileName);
      document.body.appendChild(link); link.click(); link.remove();
      setShowDropdown(false); setSearchQuery('');
    } catch { /* silent */ }
  };

  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const mainNavItems = [
    { to: '/dashboard', label: 'Dashboard', icon: <IconDashboard /> },
    ...(user?.role !== 'Administrator' ? [{ to: '/my-files', label: 'Files', icon: <IconFiles /> }] : []),
    ...(user?.role === 'Administrator' ? [{ to: '/admin', label: 'Admin Panel', icon: <IconAdmin /> }] : []),
  ];

  const extraNavItems = user?.role !== 'Administrator' ? [
    { label: 'Shared Files', icon: <IconShared />, to: '/shared-files' },
    { label: 'Vault', icon: <IconVault />, to: '/vault' },
  ] : [
    { label: 'Vault', icon: <IconVault />, to: '/vault' },
  ];

  const quickAccessItems = ['Starred', 'Finance', 'Report', 'Event'];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F8FAFC' }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: `${SIDEBAR_WIDTH}px`, flexShrink: 0,
        background: '#FFFFFF', borderRight: '1px solid #E2E8F0',
        display: 'flex', flexDirection: 'column',
        position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 100,
      }}>
        {/* Logo */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #F1F5F9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: '#22C55E', display: 'flex', alignItems: 'center',
              justifyContent: 'center', flexShrink: 0,
            }}>
              <IconShield />
            </div>
            <span style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', letterSpacing: '-0.5px' }}>
              CloudFortify
            </span>
          </div>
        </div>

        {/* Main navigation */}
        <div style={{ padding: '12px', flex: 1, overflowY: 'auto' }}>
          {mainNavItems.map(item => (
            <NavLink key={item.to} to={item.to} style={{ textDecoration: 'none' }}>
              {({ isActive }) => <NavItem label={item.label} icon={item.icon} isActive={isActive} onClick={undefined} />}
            </NavLink>
          ))}
          {extraNavItems.map(item => (
            <NavLink key={item.to} to={item.to} style={{ textDecoration: 'none' }}>
              {({ isActive }) => <NavItem label={item.label} icon={item.icon} isActive={isActive} onClick={undefined} />}
            </NavLink>
          ))}

          {/* Quick Access */}
          {user?.role !== 'Administrator' && (
            <div style={{ marginTop: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px 8px' }}>
                <span style={{ fontSize: '11px', fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Quick Access</span>
                <span style={{ color: '#94A3B8', fontSize: '18px', lineHeight: 1, cursor: 'pointer' }}>+</span>
              </div>
              {quickAccessItems.map(label => (
                <div key={label} style={{ padding: '9px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px', color: '#64748B', fontSize: '14px', cursor: 'pointer' }}>
                  <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#CBD5E1', flexShrink: 0 }} />
                  {label}
                </div>
              ))}
            </div>
          )}
        </div>

          {/* Storage indicator */}
          <div style={{ padding: '16px', borderTop: '1px solid #F1F5F9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>Storage</span>
            </div>
            <div style={{ height: '6px', background: '#E2E8F0', borderRadius: '99px', marginBottom: '6px', overflow: 'hidden' }}>
              <div style={{
                width: `${Math.min((storage.used_bytes / storage.total_bytes) * 100, 100).toFixed(1)}%`,
                height: '100%',
                background: storage.used_bytes / storage.total_bytes > 0.85
                  ? 'linear-gradient(90deg, #EF4444, #DC2626)'
                  : 'linear-gradient(90deg, #22C55E, #16A34A)',
                borderRadius: '99px',
                transition: 'width 0.4s ease',
              }} />
            </div>
            <div style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '12px' }}>
              {fmt(storage.used_bytes)} of {fmt(storage.total_bytes)} used
            </div>
            <button onClick={handleLogout} style={{
              width: '100%', padding: '10px', background: '#0F172A', color: '#FFFFFF',
              border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600',
            }}>
              Sign Out
            </button>
          </div>

        {/* Notification & Help */}
        <div style={{ padding: '8px 12px 20px', borderTop: '1px solid #F1F5F9', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {[{ label: 'Notification', icon: <IconBell /> }, { label: 'Help and Guide', icon: <IconHelp /> }].map(item => (
            <NavItem key={item.label} label={item.label} icon={item.icon} isActive={false} onClick={() => {}} />
          ))}
        </div>
      </aside>

      {/* ── Main area ── */}
      <div style={{ marginLeft: `${SIDEBAR_WIDTH}px`, flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>

        {/* Top header */}
        <header style={{
          height: '64px', background: '#FFFFFF', borderBottom: '1px solid #E2E8F0',
          display: 'flex', alignItems: 'center', padding: '0 32px', gap: '16px',
          position: 'sticky', top: 0, zIndex: 99,
        }}>
          {/* Search */}
          <div style={{ flex: 1, maxWidth: '440px', position: 'relative' }} ref={searchRef}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              background: '#F8FAFC', border: '1.5px solid #E2E8F0',
              borderRadius: '10px', padding: '9px 14px',
              borderColor: showDropdown ? '#22C55E' : '#E2E8F0',
              transition: 'border-color 0.15s',
            }}>
              <IconSearch />
              <input
                type="text"
                placeholder={user?.role === 'Administrator' ? 'Search unavailable for admins' : 'Search files by name, tag, department…'}
                value={searchQuery}
                onChange={handleSearchChange}
                disabled={user?.role === 'Administrator'}
                style={{
                  background: 'none', border: 'none', outline: 'none',
                  flex: 1, fontSize: '14px', color: '#0F172A', fontFamily: 'inherit',
                  cursor: user?.role === 'Administrator' ? 'not-allowed' : 'text',
                }}
              />
              {searchLoading && (
                <div style={{ width: '14px', height: '14px', border: '2px solid #E2E8F0', borderTopColor: '#22C55E', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
              )}
            </div>

            {/* Search results dropdown */}
            {showDropdown && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
                background: '#FFFFFF', borderRadius: '12px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)', border: '1px solid #E2E8F0',
                zIndex: 200, overflow: 'hidden', maxHeight: '360px', overflowY: 'auto',
              }}>
                {searchResults.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', fontSize: '13px', color: '#94A3B8' }}>
                    No files match &ldquo;{searchQuery}&rdquo;
                  </div>
                ) : (
                  <>
                    <div style={{ padding: '10px 16px 6px', fontSize: '11px', fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                    </div>
                    {searchResults.map(file => {
                      const sc = SENSITIVITY_COLORS[file.sensitivity_level] || SENSITIVITY_COLORS.low;
                      return (
                        <div key={file.id} style={{
                          display: 'flex', alignItems: 'center', gap: '12px',
                          padding: '10px 16px', borderTop: '1px solid #F8FAFC', transition: 'background 0.1s',
                        }}
                          onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <IconFile />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '13px', fontWeight: '500', color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {file.original_name}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                              <span style={{ fontSize: '10px', fontWeight: '600', padding: '1px 7px', borderRadius: '20px', background: sc.bg, color: sc.text }}>
                                {file.sensitivity_level}
                              </span>
                              {file.department && <span style={{ fontSize: '11px', color: '#94A3B8' }}>{file.department}</span>}
                              <span style={{ fontSize: '11px', color: '#94A3B8' }}>{fmt(file.size_bytes)}</span>
                            </div>
                          </div>
                          <button onClick={() => handleDownload(file.id, file.original_name)} style={{
                            padding: '5px 12px', background: '#22C55E', color: '#fff',
                            border: 'none', borderRadius: '6px', fontSize: '11px',
                            fontWeight: '600', cursor: 'pointer', flexShrink: 0,
                          }}>
                            Download
                          </button>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            )}
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px',
              background: 'none', border: '1.5px solid #E2E8F0', borderRadius: '8px',
              color: '#475569', fontSize: '13px', fontWeight: '500', cursor: 'pointer',
            }}>
              <IconInvite />
              Invite Members
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#0F172A', whiteSpace: 'nowrap' }}>{user?.full_name}</div>
                <div style={{ fontSize: '11px', color: '#64748B' }}>{user?.role}</div>
              </div>
              <div style={{
                width: '36px', height: '36px', borderRadius: '50%',
                background: '#22C55E', display: 'flex', alignItems: 'center',
                justifyContent: 'center', color: 'white', fontSize: '13px',
                fontWeight: '700', flexShrink: 0, border: '2px solid #BBF7D0',
              }}>
                {initials}
              </div>
            </div>
          </div>
        </header>

        <main style={{ flex: 1, padding: '32px' }}>
          <Outlet />
        </main>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default Layout;