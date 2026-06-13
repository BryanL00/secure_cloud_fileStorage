import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const fmtSize = bytes => {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
};

const fmtDate = iso => iso
  ? new Date(iso).toLocaleDateString('en-SG', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '—';

const SENSITIVITY_COLORS = {
  low:          { bg: '#F0FDF4', text: '#16A34A', border: '#BBF7D0' },
  medium:       { bg: '#FFFBEB', text: '#D97706', border: '#FDE68A' },
  high:         { bg: '#FFF7ED', text: '#EA580C', border: '#FED7AA' },
  confidential: { bg: '#FFF1F2', text: '#E11D48', border: '#FECDD3' },
};

const SensitivityBadge = ({ level }) => {
  const s = level?.toLowerCase();
  const colors = SENSITIVITY_COLORS[s] || { bg: '#F8FAFC', text: '#64748B', border: '#E2E8F0' };
  return (
    <span style={{
      padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: '600',
      background: colors.bg, color: colors.text, border: `1px solid ${colors.border}`,
      textTransform: 'capitalize',
    }}>
      {level || 'N/A'}
    </span>
  );
};

const Vault = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Administrator';

  const [files, setFiles]                 = useState([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [toast, setToast]                 = useState(null);

  useEffect(() => { fetchDeletedFiles(); }, []);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchDeletedFiles = async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get('/files/deleted');
      setFiles(res.data.files || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load vault');
    } finally { setLoading(false); }
  };

  const handleRestore = async (file) => {
    setActionLoading(`restore-${file.id}`);
    try {
      await api.post(`/files/${file.id}/restore`);
      setFiles(prev => prev.filter(f => f.id !== file.id));
      window.dispatchEvent(new Event('storage-updated'));
      showToast(`"${file.original_name}" restored successfully.`);
    } catch (err) {
      showToast(err.response?.data?.message || 'Restore failed', 'error');
    } finally { setActionLoading(null); }
  };

  const handleEmptyRecycleBin = async () => {
    const confirmed = window.confirm(
      `EMPTY THE ENTIRE RECYCLE BIN?\n\nThis permanently erases all ${files.length} file(s) and their encryption keys. This action cannot be undone.`
    );
    if (!confirmed) return;
    setActionLoading('empty-bin');
    try {
      const res = await api.delete('/files/recycle-bin/empty');
      setFiles([]);
      showToast(res.data.message || 'Recycle bin emptied.', 'warning');
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to empty recycle bin', 'error');
    } finally { setActionLoading(null); }
  };

  const handlePermanentDelete = async (file) => {
    const confirmed = window.confirm(
      `PERMANENTLY DELETE "${file.original_name}"?\n\nThis action cannot be undone. The file and all its encryption keys will be erased forever.`
    );
    if (!confirmed) return;
    setActionLoading(`delete-${file.id}`);
    try {
      await api.delete(`/files/${file.id}/permanent`);
      setFiles(prev => prev.filter(f => f.id !== file.id));
      showToast(`"${file.original_name}" permanently erased.`, 'warning');
    } catch (err) {
      showToast(err.response?.data?.message || 'Permanent delete failed', 'error');
    } finally { setActionLoading(null); }
  };

  return (
    <div style={{ padding: '32px', maxWidth: '1100px' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: '24px', right: '24px', zIndex: 9999,
          padding: '14px 20px', borderRadius: '12px', fontSize: '13px', fontWeight: '500',
          boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
          background: toast.type === 'error' ? '#FFF1F2' : toast.type === 'warning' ? '#FFFBEB' : '#F0FDF4',
          color: toast.type === 'error' ? '#E11D48' : toast.type === 'warning' ? '#D97706' : '#16A34A',
          border: `1px solid ${toast.type === 'error' ? '#FECDD3' : toast.type === 'warning' ? '#FDE68A' : '#BBF7D0'}`,
          maxWidth: '360px',
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #F59E0B, #D97706)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6"/>
              <path d="M14 11v6"/>
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: '#0F172A' }}>Recycle Bin</h1>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748B' }}>
              {isAdmin
                ? 'All soft-deleted files — restore or permanently erase after audit'
                : 'Your deleted files — restore to recover or wait for admin to permanently erase'}
            </p>
          </div>
        </div>
      </div>

      {/* Admin notice */}
      {isAdmin && (
        <div style={{ padding: '12px 16px', borderRadius: '10px', marginBottom: '20px', background: '#FFFBEB', border: '1px solid #FDE68A', fontSize: '13px', color: '#92400E', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#D97706">
            <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
          </svg>
          As Administrator, you can permanently erase files. This action is irreversible and will be recorded in the audit log.
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ padding: '14px 16px', borderRadius: '10px', background: '#FFF1F2', border: '1px solid #FECDD3', color: '#E11D48', fontSize: '13px', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748B' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', border: '3px solid #E2E8F0', borderTopColor: '#F59E0B', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }}/>
          Loading recycle bin…
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && files.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 24px', background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '16px' }}>
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6"/>
            <path d="M14 11v6"/>
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          </svg>
          <div style={{ fontSize: '16px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>Recycle Bin is empty</div>
          <div style={{ fontSize: '13px', color: '#94A3B8' }}>
            {isAdmin ? 'No soft-deleted files in the system.' : 'You have no deleted files.'}
          </div>
        </div>
      )}

      {/* Table */}
      {!loading && files.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', gap: '12px' }}>
            <div style={{ fontSize: '13px', color: '#64748B', fontWeight: '500' }}>
              {files.length} file{files.length !== 1 ? 's' : ''} in recycle bin
            </div>
            {isAdmin && (
              <button
                onClick={handleEmptyRecycleBin}
                disabled={actionLoading === 'empty-bin'}
                style={{
                  padding: '8px 16px', fontSize: '13px', fontWeight: '600',
                  color: '#fff', background: '#DC2626', border: 'none',
                  borderRadius: '8px', cursor: actionLoading === 'empty-bin' ? 'not-allowed' : 'pointer',
                  opacity: actionLoading === 'empty-bin' ? 0.6 : 1,
                }}
              >
                {actionLoading === 'empty-bin' ? 'Emptying…' : 'Empty Recycle Bin'}
              </button>
            )}
          </div>
          <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC' }}>
                    {['File', ...(isAdmin ? ['Owner'] : []), 'Department', 'Sensitivity', 'Size', 'Deleted On', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #E2E8F0' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {files.map((file, i) => {
                    const isRestoring = actionLoading === `restore-${file.id}`;
                    const isDeleting  = actionLoading === `delete-${file.id}`;
                    const anyLoading  = isRestoring || isDeleting;
                    return (
                      <tr key={file.id} style={{ borderBottom: i < files.length - 1 ? '1px solid #F1F5F9' : 'none' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#FAFAFA'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#FEF9C3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="#CA8A04">
                                <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/>
                              </svg>
                            </div>
                            <div>
                              <div style={{ fontSize: '13px', fontWeight: '500', color: '#0F172A', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={file.original_name}>
                                {file.original_name}
                              </div>
                              {file.project_category && <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>{file.project_category}</div>}
                            </div>
                          </div>
                        </td>
                        {isAdmin && <td style={{ padding: '14px 16px', fontSize: '13px', color: '#475569' }}>{file.owner_email || '—'}</td>}
                        <td style={{ padding: '14px 16px' }}>
                          {file.department
                            ? <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '12px', background: '#EFF6FF', color: '#1D4ED8', fontWeight: '500' }}>{file.department}</span>
                            : <span style={{ color: '#CBD5E1', fontSize: '13px' }}>—</span>}
                        </td>
                        <td style={{ padding: '14px 16px' }}><SensitivityBadge level={file.sensitivity_level} /></td>
                        <td style={{ padding: '14px 16px', fontSize: '13px', color: '#64748B' }}>{fmtSize(file.size_bytes)}</td>
                        <td style={{ padding: '14px 16px', fontSize: '12px', color: '#94A3B8' }}>{fmtDate(file.updated_at || file.uploaded_at)}</td>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <button onClick={() => handleRestore(file)} disabled={anyLoading} style={{
                              padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '600',
                              background: isRestoring ? '#E2E8F0' : '#22C55E',
                              color: isRestoring ? '#94A3B8' : '#fff',
                              border: 'none', cursor: anyLoading ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
                            }}>
                              {isRestoring ? 'Restoring…' : 'Restore'}
                            </button>
                            {isAdmin && (
                              <button onClick={() => handlePermanentDelete(file)} disabled={anyLoading} style={{
                                padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '600',
                                background: isDeleting ? '#E2E8F0' : '#FFF1F2',
                                color: isDeleting ? '#94A3B8' : '#E11D48',
                                border: `1px solid ${isDeleting ? '#E2E8F0' : '#FECDD3'}`,
                                cursor: anyLoading ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
                              }}>
                                {isDeleting ? 'Erasing…' : 'Erase'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Vault;