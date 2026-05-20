import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = user?.full_name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase() || 'U';

  return (
    <nav style={{
      background: '#E0E5EC',
      padding: '16px 32px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      boxShadow: '0 4px 12px #b8bec7',
      position: 'sticky',
      top: 0,
      zIndex: 100
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '36px', height: '36px', borderRadius: '50%',
          background: '#5B6EAE', display: 'flex', alignItems: 'center',
          justifyContent: 'center', color: 'white', fontSize: '13px', fontWeight: '600'
        }}>
          {initials}
        </div>
        <div>
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#4A5568' }}>
            {user?.full_name}
          </div>
          <div style={{ fontSize: '11px', color: '#8896A5' }}>{user?.role}</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Link to="/dashboard" style={{ textDecoration: 'none' }}>
          <button className="neu-btn">Dashboard</button>
        </Link>
        {user?.role === 'Administrator' && (
          <Link to="/admin" style={{ textDecoration: 'none' }}>
            <button className="neu-btn" style={{ color: '#5B6EAE' }}>Admin Panel</button>
          </Link>
        )}
        <button className="neu-btn" onClick={handleLogout} style={{ color: '#A05070' }}>
          Logout
        </button>
      </div>
    </nav>
  );
};

export default Navbar;