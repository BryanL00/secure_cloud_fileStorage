import { useState, useEffect } from 'react';
import api from '../utils/api';

const SENSITIVITY_COLORS = {
  low:          { bg: '#F0FDF4', text: '#16A34A', border: '#BBF7D0' },
  medium:       { bg: '#FFFBEB', text: '#D97706', border: '#FDE68A' },
  high:         { bg: '#FFF7ED', text: '#EA580C', border: '#FED7AA' },
  confidential: { bg: '#FFF1F2', text: '#E11D48', border: '#FECDD3' },
};

const fmtSize = bytes => {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
};

const fmtDate = iso => iso ? new Date(iso).toLocaleDateString('en-SG', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

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

const SharedFiles = () => {
  const [files, setFiles]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [downloading, setDownloading] = useState(null);
  const [filterDept, setFilterDept]   = useState('');
  const [filterSens, setFilterSens]   = useState('');
  const [previewFile, setPreviewFile] = useState(null);
  const [previewUrl, setPreviewUrl]   = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => { fetchSharedFiles(); }, []);

  const fetchSharedFiles = async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get('/files/shared');
      setFiles(res.data.files || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load shared files');
    } finally { setLoading(false); }
  };

  const handlePreview = async (file) => {
    setPreviewFile(file); setPreviewUrl(null); setPreviewLoading(true);
    try {
      const res = await api.get(`/files/preview/${file.id}`, { responseType: 'blob' });
      setPreviewUrl(URL.createObjectURL(new Blob([res.data], { type: file.mime_type || 'application/octet-stream' })));
    } catch { setPreviewFile(null); alert('Preview failed'); }
    finally { setPreviewLoading(false); }
  };

  const closePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewFile(null); setPreviewUrl(null);
  };

  const handleDownload = async (file) => {
    setDownloading(file.id);
    try {
      const res = await api.get(`/files/download/${file.id}`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url; a.download = file.original_name;
      a.click(); URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.response?.data?.message || 'Download failed');
    } finally { setDownloading(null); }
  };

  const departments = [...new Set(files.map(f => f.department).filter(Boolean))].sort();
  const sensLevels  = [...new Set(files.map(f => f.sensitivity_level).filter(Boolean))].sort();

  const visible = files.filter(f => {
    if (filterDept && f.department !== filterDept) return false;
    if (filterSens && f.sensitivity_level !== filterSens) return false;
    return true;
  });

  return (
    <div>
    {/* Preview modal */}
    {previewFile && (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
        <div style={{ width: '90vw', maxWidth: '960px', height: '88vh', background: '#fff', borderRadius: '16px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid #F1F5F9', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#64748B"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/></svg>
              <span style={{ fontSize: '14px', fontWeight: '600', color: '#0F172A' }}>{previewFile.original_name}</span>
            </div>
            <button onClick={closePreview} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', padding: '4px', display: 'flex' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
            </button>
          </div>
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC' }}>
            {previewLoading && <div style={{ color: '#64748B', fontSize: '14px' }}>Loading preview…</div>}
            {!previewLoading && previewUrl && (() => {
              const mime = previewFile.mime_type || '';
              if (mime === 'application/pdf') return <iframe src={previewUrl} style={{ width: '100%', height: '100%', border: 'none' }} title="preview" />;
              if (mime.startsWith('image/')) return <img src={previewUrl} alt={previewFile.original_name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />;
              if (mime.startsWith('text/') || mime === 'application/json') return <iframe src={previewUrl} style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }} title="preview" />;
              return (
                <div style={{ textAlign: 'center', color: '#64748B' }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="#CBD5E1" style={{ marginBottom: '12px' }}><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/></svg>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>Preview not available</div>
                  <div style={{ fontSize: '13px' }}>This file type cannot be previewed in the browser.</div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    )}
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #22C55E, #16A34A)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
            </svg>
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: '#0F172A' }}>Shared with Me</h1>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748B' }}>Files that collaborators have shared with your account</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      {!loading && files.length > 0 && (
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <select value={filterDept} onChange={e => setFilterDept(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '13px', color: '#374151', background: '#fff', cursor: 'pointer' }}>
            <option value="">All Departments</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={filterSens} onChange={e => setFilterSens(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '13px', color: '#374151', background: '#fff', cursor: 'pointer' }}>
            <option value="">All Sensitivity Levels</option>
            {sensLevels.map(s => <option key={s} value={s} style={{ textTransform: 'capitalize' }}>{s}</option>)}
          </select>
          {(filterDept || filterSens) && (
            <button onClick={() => { setFilterDept(''); setFilterSens(''); }} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '13px', color: '#64748B', background: '#F8FAFC', cursor: 'pointer' }}>
              Clear filters
            </button>
          )}
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
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', border: '3px solid #E2E8F0', borderTopColor: '#22C55E', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }}/>
          Loading shared files…
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && files.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 24px', background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="#CBD5E1" style={{ marginBottom: '16px' }}>
            <path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6 10H8v-2h6v2zm4-4H8v-2h10v2z"/>
          </svg>
          <div style={{ fontSize: '16px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>No shared files</div>
          <div style={{ fontSize: '13px', color: '#94A3B8' }}>Files shared with you by managers will appear here.</div>
        </div>
      )}

      {/* No results after filter */}
      {!loading && !error && files.length > 0 && visible.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 24px', background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', color: '#64748B', fontSize: '14px' }}>
          No files match the selected filters.
        </div>
      )}

      {/* Table */}
      {!loading && visible.length > 0 && (
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #F1F5F9' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>
              {visible.length} file{visible.length !== 1 ? 's' : ''}{(filterDept || filterSens) ? ' (filtered)' : ' shared with you'}
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8FAFC' }}>
                  {['File Name', 'Shared By', 'Department', 'Sensitivity', 'Permission', 'Size', 'Shared On', ''].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #E2E8F0' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((file, i) => (
                  <tr key={file.id} style={{ borderBottom: i < visible.length - 1 ? '1px solid #F1F5F9' : 'none' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="#16A34A">
                            <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/>
                          </svg>
                        </div>
                        <span style={{ fontSize: '13px', fontWeight: '500', color: '#0F172A', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={file.original_name}>
                          {file.original_name}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '13px', color: '#475569' }}>{file.shared_by_email || '—'}</td>
                    <td style={{ padding: '14px 16px' }}>
                      {file.department
                        ? <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '12px', background: '#EFF6FF', color: '#1D4ED8', fontWeight: '500' }}>{file.department}</span>
                        : <span style={{ color: '#CBD5E1', fontSize: '13px' }}>—</span>}
                    </td>
                    <td style={{ padding: '14px 16px' }}><SensitivityBadge level={file.sensitivity_level} /></td>
                    <td style={{ padding: '14px 16px' }}>
                      {file.permission_level === 'viewer'
                        ? <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: '600', background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE' }}>Viewer</span>
                        : <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: '600', background: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}>Metadata only</span>
                      }
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '13px', color: '#64748B' }}>{fmtSize(file.file_size || file.size_bytes)}</td>
                    <td style={{ padding: '14px 16px', fontSize: '13px', color: '#64748B' }}>{fmtDate(file.shared_at || file.uploaded_at)}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <button onClick={() => handlePreview(file)} style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', background: '#F8FAFC', color: '#374151', border: '1px solid #E2E8F0', cursor: 'pointer' }}>
                          Preview
                        </button>
                        {file.permission_level === 'viewer' ? (
                          <button onClick={() => handleDownload(file)} disabled={downloading === file.id} style={{
                            padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '600',
                            background: downloading === file.id ? '#E2E8F0' : '#22C55E',
                            color: downloading === file.id ? '#94A3B8' : '#fff',
                            border: 'none', cursor: downloading === file.id ? 'not-allowed' : 'pointer',
                          }}>
                            {downloading === file.id ? 'Downloading…' : 'Download'}
                          </button>
                        ) : (
                          <span style={{ fontSize: '12px', color: '#94A3B8', fontStyle: 'italic' }}>View only</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default SharedFiles;