import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

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

const IconTrash = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
    <path d="M10 11v6M14 11v6"/>
    <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
  </svg>
);

const IconCloud = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
    <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>
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

const NavItem = ({ label, icon, isActive, onClick }) => (
  <div
    onClick={onClick}
    style={{
      padding: '10px 12px',
      borderRadius: '8px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
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

const Layout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = user?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';

  const mainNavItems = [
    { to: '/dashboard', label: 'Dashboard', icon: <IconDashboard /> },
    ...(user?.role !== 'Administrator' ? [
      { to: '/my-files', label: 'Files', icon: <IconFiles /> },
    ] : []),
    ...(user?.role === 'Administrator' ? [
      { to: '/admin', label: 'Admin Panel', icon: <IconAdmin /> },
    ] : []),
  ];

  const extraNavItems = user?.role !== 'Administrator' ? [
    { label: 'Shared', icon: <IconShared /> },
    { label: 'Deleted Files', icon: <IconTrash /> },
  ] : [];

  const quickAccessItems = ['Starred', 'Finance', 'Report', 'Event'];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F8FAFC' }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: `${SIDEBAR_WIDTH}px`,
        flexShrink: 0,
        background: '#FFFFFF',
        borderRight: '1px solid #E2E8F0',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: 0, left: 0,
        height: '100vh',
        zIndex: 100,
      }}>

        {/* Logo */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #F1F5F9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: '#22C55E', display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <IconCloud />
            </div>
            <span style={{ fontSize: '18px', fontWeight: '700', color: '#0F172A', letterSpacing: '-0.3px' }}>
              Cloudy
            </span>
          </div>
        </div>

        {/* Main navigation */}
        <div style={{ padding: '12px', flex: 1, overflowY: 'auto' }}>
          {mainNavItems.map(item => (
            <NavLink key={item.to} to={item.to} style={{ textDecoration: 'none' }}>
              {({ isActive }) => (
                <NavItem label={item.label} icon={item.icon} isActive={isActive} onClick={undefined} />
              )}
            </NavLink>
          ))}

          {extraNavItems.map(item => (
            <NavItem key={item.label} label={item.label} icon={item.icon} isActive={false} onClick={() => {}} />
          ))}

          {/* Quick Access */}
          {user?.role !== 'Administrator' && (
            <div style={{ marginTop: '20px' }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0 12px 8px',
              }}>
                <span style={{
                  fontSize: '11px', fontWeight: '600', color: '#94A3B8',
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                }}>
                  Quick Access
                </span>
                <span style={{ color: '#94A3B8', fontSize: '18px', lineHeight: 1, cursor: 'pointer', userSelect: 'none' }}>+</span>
              </div>
              {quickAccessItems.map(label => (
                <div key={label} style={{
                  padding: '9px 12px', borderRadius: '8px',
                  display: 'flex', alignItems: 'center', gap: '10px',
                  color: '#64748B', fontSize: '14px', cursor: 'pointer',
                }}>
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
              <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>
            </svg>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>Storage</span>
          </div>
          <div style={{ height: '6px', background: '#E2E8F0', borderRadius: '99px', marginBottom: '6px', overflow: 'hidden' }}>
            <div style={{ width: '56%', height: '100%', background: 'linear-gradient(90deg, #22C55E, #16A34A)', borderRadius: '99px' }} />
          </div>
          <div style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '12px' }}>500 GB of 900 GB used</div>
          <button
            onClick={handleLogout}
            style={{
              width: '100%', padding: '10px', background: '#0F172A', color: '#FFFFFF',
              border: 'none', borderRadius: '8px', cursor: 'pointer',
              fontSize: '13px', fontWeight: '600', letterSpacing: '0.01em',
            }}
          >
            Sign Out
          </button>
        </div>

        {/* Notification & Help */}
        <div style={{ padding: '8px 12px 20px', borderTop: '1px solid #F1F5F9', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {[
            { label: 'Notification', icon: <IconBell /> },
            { label: 'Help and Guide', icon: <IconHelp /> },
          ].map(item => (
            <NavItem key={item.label} label={item.label} icon={item.icon} isActive={false} onClick={() => {}} />
          ))}
        </div>
      </aside>

      {/* ── Main area ── */}
      <div style={{ marginLeft: `${SIDEBAR_WIDTH}px`, flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>

        {/* Top header */}
        <header style={{
          height: '64px',
          background: '#FFFFFF',
          borderBottom: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          padding: '0 32px',
          gap: '16px',
          position: 'sticky',
          top: 0,
          zIndex: 99,
        }}>
          {/* Search */}
          <div style={{ flex: 1, maxWidth: '440px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              background: '#F8FAFC', border: '1.5px solid #E2E8F0',
              borderRadius: '10px', padding: '9px 14px',
            }}>
              <IconSearch />
              <input
                type="text"
                placeholder="Search"
                style={{
                  background: 'none', border: 'none', outline: 'none',
                  flex: 1, fontSize: '14px', color: '#0F172A', fontFamily: 'inherit',
                }}
              />
            </div>
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Invite Members */}
            <button style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px', background: 'none',
              border: '1.5px solid #E2E8F0', borderRadius: '8px',
              color: '#475569', fontSize: '13px', fontWeight: '500', cursor: 'pointer',
              transition: 'border-color 0.15s',
            }}>
              <IconInvite />
              Invite Members
            </button>

            {/* User profile */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#0F172A', whiteSpace: 'nowrap' }}>
                  {user?.full_name}
                </div>
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

        {/* Page content */}
        <main style={{ flex: 1, padding: '32px' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;