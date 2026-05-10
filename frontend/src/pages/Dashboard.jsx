import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = async () => {
  try {
    if (user?.role === 'Administrator') {
      // Admin cannot access files — only fetch folders count
      const usersRes = await api.get('/users');
      setLoading(false);
      return;
    }

    const [filesRes, foldersRes] = await Promise.all([
      api.get('/files'),
      api.get('/folders')
    ]);
    setFiles(filesRes.data.files);
    setFolders(foldersRes.data.folders);
  } catch (err) {
    setError('Failed to load data');
  } finally {
    setLoading(false);
  }
};

  useEffect(() => { fetchData(); }, []);

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes/1024).toFixed(1)} KB`;
    return `${(bytes/1048576).toFixed(1)} MB`;
  };

  const totalSize = files.reduce((acc, f) => acc + (f.size_bytes || 0), 0);
  const sensitivityCounts = { low: 0, medium: 0, high: 0, confidential: 0 };
  files.forEach(f => { if (sensitivityCounts[f.sensitivity_level] !== undefined) sensitivityCounts[f.sensitivity_level]++; });

  const getBadgeClass = (level) => {
    const map = { low: 'badge-low', medium: 'badge-medium', high: 'badge-high', confidential: 'badge-confidential' };
    return `badge ${map[level] || 'badge-low'}`;
  };

  const handleDownload = async (fileId, fileName) => {
    try {
      const res = await api.get(`/files/download/${fileId}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError('Download failed');
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '20px', fontWeight: '600', color: '#4A5568' }}>Dashboard</div>
        <div style={{ fontSize: '13px', color: '#8896A5', marginTop: '2px' }}>
          Welcome back, {user?.full_name}
        </div>
      </div>

      {error && <div className="error-box">{error}</div>}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: 'Total Files', value: files.length },
          { label: 'Total Folders', value: folders.length },
          { label: 'Storage Used', value: formatSize(totalSize) },
          { label: 'Your Role', value: user?.role }
        ].map((stat, i) => (
          <div key={i} className="neu-raised" style={{ padding: '20px' }}>
            <div style={{ fontSize: '11px', color: '#8896A5', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {stat.label}
            </div>
            <div style={{ fontSize: '22px', fontWeight: '600', color: '#5B6EAE' }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Sensitivity Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px', marginBottom: '24px' }}>
        {Object.entries(sensitivityCounts).map(([level, count]) => (
          <div key={level} className="neu-raised" style={{ padding: '16px' }}>
            <span className={getBadgeClass(level)} style={{ marginBottom: '8px', display: 'inline-block' }}>
              {level}
            </span>
            <div style={{ fontSize: '20px', fontWeight: '600', color: '#4A5568' }}>{count} files</div>
          </div>
        ))}
      </div>

   {/* Quick Actions */}
<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
  <div className="neu-raised" style={{ padding: '20px' }}>
    <div style={{ fontSize: '14px', fontWeight: '600', color: '#4A5568', marginBottom: '8px' }}>
      Quick Actions
    </div>
    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
      {user?.role !== 'Administrator' && (
        <button className="neu-btn-primary" onClick={() => navigate('/my-files')}
          style={{ fontSize: '12px', padding: '10px 16px' }}>
          Go to My Files
        </button>
      )}
      {user?.role === 'Administrator' && (
        <button className="neu-btn-primary" onClick={() => navigate('/admin')}
          style={{ fontSize: '12px', padding: '10px 16px' }}>
          Manage Users
        </button>
      )}
      {user?.role === 'Administrator' && (
        <button className="neu-btn" onClick={() => navigate('/admin')}
          style={{ fontSize: '12px', padding: '10px 16px' }}>
          View Audit Logs
        </button>
      )}
    </div>
  </div>

  {user?.role === 'Administrator' ? (
    <div className="neu-raised" style={{ padding: '20px' }}>
      <div style={{ fontSize: '14px', fontWeight: '600', color: '#4A5568', marginBottom: '8px' }}>
        File Access
      </div>
      <div className="neu-pressed" style={{ padding: '16px', borderRadius: '12px' }}>
        <div style={{ fontSize: '13px', color: '#8896A5' }}>
          Administrators do not have access to file contents. Use the Admin Panel to manage users and view audit logs.
        </div>
      </div>
    </div>
  ) : (
    <div className="neu-raised" style={{ padding: '20px' }}>
      <div style={{ fontSize: '14px', fontWeight: '600', color: '#4A5568', marginBottom: '12px' }}>
        Recent Files
      </div>
      {loading ? (
        <div style={{ fontSize: '12px', color: '#8896A5' }}>Loading...</div>
      ) : files.length === 0 ? (
        <div style={{ fontSize: '12px', color: '#8896A5' }}>No files yet</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {files.slice(0, 4).map(file => (
            <div key={file.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '12px', color: '#4A5568', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                {file.original_name}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className={getBadgeClass(file.sensitivity_level)} style={{ fontSize: '10px' }}>
                  {file.sensitivity_level}
                </span>
                <button className="neu-btn" style={{ padding: '4px 8px', fontSize: '10px' }}
                  onClick={() => handleDownload(file.id, file.original_name)}>
                  ↓
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )}
</div>
</div>
  );
};

export default Dashboard;