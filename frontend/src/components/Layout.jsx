import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Layout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = user?.full_name
    ?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';

  const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
    </svg>
  )},
  ...(user?.role !== 'Administrator' ? [{
    to: '/my-files', label: 'My Files', icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
      </svg>
    )
  }] : []),
  ...(user?.role === 'Administrator' ? [{
    to: '/admin', label: 'Admin Panel', icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
      </svg>
    )
  }] : [])
];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#E0E5EC' }}>

      {/* Left Sidebar */}
      <div style={{
        width: '240px', flexShrink: 0,
        background: '#E0E5EC', padding: '24px 16px',
        boxShadow: '4px 0 12px #b8bec7',
        display: 'flex', flexDirection: 'column',
        position: 'fixed', top: 0, left: 0,
        height: '100vh', zIndex: 100
      }}>
        {/* Logo */}
        <div style={{ padding: '8px 12px', marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '12px',
              background: '#E0E5EC', display: 'flex', alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '4px 4px 8px #b8bec7, -4px -4px 8px #ffffff'
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5B6EAE" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2"/>
                <path d="M7 11V7a5 5 0 0110 0v4"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#4A5568' }}>Secure Cloud</div>
              <div style={{ fontSize: '10px', color: '#8896A5' }}>File Storage</div>
            </div>
          </div>
        </div>

        {/* Nav Items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              style={{ textDecoration: 'none' }}
            >
              {({ isActive }) => (
                <div style={{
                  padding: '12px 16px', borderRadius: '12px',
                  display: 'flex', alignItems: 'center', gap: '12px',
                  color: isActive ? '#5B6EAE' : '#8896A5',
                  fontWeight: isActive ? '600' : '400',
                  fontSize: '13px',
                  boxShadow: isActive
                    ? 'inset 3px 3px 6px #b8bec7, inset -3px -3px 6px #ffffff'
                    : 'none',
                  transition: 'all 0.2s ease'
                }}>
                  {item.icon}
                  {item.label}
                </div>
              )}
            </NavLink>
          ))}
        </div>

        {/* User Profile at Bottom */}
        <div style={{ borderTop: '1px solid #c8cdd5', paddingTop: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', marginBottom: '8px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '50%',
              background: '#5B6EAE', display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: 'white', fontSize: '13px', fontWeight: '600',
              flexShrink: 0
            }}>
              {initials}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#4A5568', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.full_name}
              </div>
              <div style={{ fontSize: '10px', color: '#8896A5' }}>{user?.role}</div>
            </div>
          </div>
          <button
            className="neu-btn"
            onClick={handleLogout}
            style={{ width: '100%', color: '#A05070', fontSize: '12px', padding: '10px' }}
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ marginLeft: '240px', flex: 1, padding: '32px' }}>
        <Outlet />
      </div>
    </div>
  );
};

export default Layout;