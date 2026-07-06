import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const MyFiles = () => {
  const { user } = useAuth();
  const [files, setFiles]               = useState([]);
  const [folders, setFolders]           = useState([]);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [loading, setLoading]           = useState(true);
  const [uploading, setUploading]       = useState(false);
  const [error, setError]               = useState('');
  const [success, setSuccess]           = useState('');
  const [showUpload, setShowUpload]     = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [uploadMode, setUploadMode]     = useState('file');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [deleting, setDeleting]         = useState(false);
  const [uploadForm, setUploadForm]     = useState({ file: null, sensitivity_level: 'low', project_category: '', department: '' });
  const [shareModal, setShareModal]           = useState(null);
  const [shareEmail, setShareEmail]           = useState('');
  const [sharePermission, setSharePermission] = useState('viewer');
  const [sharing, setSharing]                 = useState(false);
  const [fileShares, setFileShares]           = useState([]);
  const [fileOwner, setFileOwner]             = useState(null);
  const [sharesLoading, setSharesLoading]     = useState(false);
  const [previewFile, setPreviewFile]         = useState(null);
  const [previewUrl, setPreviewUrl]           = useState(null);
  const [previewLoading, setPreviewLoading]   = useState(false);
  const canUpload = ['Department Manager', 'Project Manager', 'User'].includes(user?.role);
  const canDelete = ['Department Manager', 'Project Manager', 'User'].includes(user?.role);
  const canShare  = ['Department Manager', 'Project Manager'].includes(user?.role);

  const fetchData = async () => {
    try {
      const [filesRes, foldersRes] = await Promise.all([api.get('/files'), api.get('/folders')]);
      setFiles(filesRes.data.files);
      setFolders(foldersRes.data.folders);
      // Refresh the sidebar storage indicator in step with the file list.
      window.dispatchEvent(new Event('storage-updated'));
    } catch { setError('Failed to load files'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  // Auto-dismiss success/error banners so they don't linger on the page.
  useEffect(() => {
    if (!error && !success) return;
    const t = setTimeout(() => { setError(''); setSuccess(''); }, 4000);
    return () => clearTimeout(t);
  }, [error, success]);

  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      await api.post('/folders', { name: newFolderName, parent_id: currentFolder || null });
      setSuccess('Folder created'); setNewFolderName(''); setShowNewFolder(false); fetchData();
    } catch (err) { setError(err.response?.data?.message || 'Failed to create folder'); }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadForm.file) return;
    setUploading(true); setError(''); setSuccess('');
    const formData = new FormData();
    formData.append('file', uploadForm.file);
    formData.append('sensitivity_level', uploadForm.sensitivity_level);
    formData.append('project_category', uploadForm.project_category);
    formData.append('department', uploadForm.department || '');
    if (currentFolder) formData.append('folder_id', currentFolder);
    try {
      await api.post('/files/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setSuccess('File encrypted and uploaded');
      setUploadForm({ file: null, sensitivity_level: 'low', project_category: '', department: '' });
      setShowUpload(false); fetchData();
    } catch (err) { setError(err.response?.data?.message || 'Upload failed'); }
    finally { setUploading(false); }
  };

  const handleFolderUpload = async (e) => {
    // Skip OS junk / hidden files (.DS_Store, .git, etc.) that folders carry.
    const fileList = Array.from(e.target.files).filter(
      f => !f.webkitRelativePath.split('/').some(seg => seg.startsWith('.'))
    );
    if (!fileList.length) return;
    setUploading(true); setError(''); setSuccess('');
    try {
      const folderIdMap = {};
      const rootName = fileList[0].webkitRelativePath.split('/')[0];
      const rootRes = await api.post('/folders', { name: rootName, parent_id: currentFolder || null });
      folderIdMap[rootName] = rootRes.data.folder.id;
      const subPaths = new Set();
      fileList.forEach(f => {
        const parts = f.webkitRelativePath.split('/');
        for (let i = 2; i < parts.length; i++) subPaths.add(parts.slice(0, i).join('/'));
      });
      for (const path of [...subPaths].sort((a,b) => a.split('/').length - b.split('/').length)) {
        const parts = path.split('/');
        const name = parts[parts.length - 1];
        const parentPath = parts.slice(0, -1).join('/');
        const res = await api.post('/folders', { name, parent_id: folderIdMap[parentPath] || null });
        folderIdMap[path] = res.data.folder.id;
      }
      // Send files in batches so a large folder costs a few requests, not one
      // per file (which would trip the upload rate limit). Must match the
      // backend's MAX_BATCH_FILES.
      const BATCH_SIZE = 50;
      let processed = 0, totalUploaded = 0, totalSkipped = 0, totalFailed = 0;
      for (let i = 0; i < fileList.length; i += BATCH_SIZE) {
        const batch = fileList.slice(i, i + BATCH_SIZE);
        const fd = new FormData();
        const folderIds = [];
        for (const file of batch) {
          const parts = file.webkitRelativePath.split('/');
          const fileFolderPath = parts.slice(0, -1).join('/');
          fd.append('files', file);
          folderIds.push(folderIdMap[fileFolderPath] || currentFolder || null);
        }
        fd.append('folder_ids', JSON.stringify(folderIds));
        fd.append('sensitivity_level', uploadForm.sensitivity_level);
        fd.append('project_category', uploadForm.project_category);
        fd.append('department', uploadForm.department || '');
        const res = await api.post('/files/upload/batch', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        totalUploaded += res.data.uploaded?.length || 0;
        totalSkipped += res.data.skipped?.length || 0;
        totalFailed += res.data.failed?.length || 0;
        processed += batch.length;
        setSuccess(`Uploading... ${processed}/${fileList.length} files`);
      }
      let summary = `Uploaded ${totalUploaded} of ${fileList.length} files`;
      if (totalSkipped) summary += ` · ${totalSkipped} skipped (already exist)`;
      if (totalFailed) summary += ` · ${totalFailed} failed`;
      setSuccess(summary);
      setShowUpload(false); fetchData();
    } catch (err) { setError(err.response?.data?.message || 'Folder upload failed'); }
    finally { setUploading(false); }
  };

  const handleDownload = async (fileId, fileName) => {
    try {
      const res = await api.get(`/files/download/${fileId}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url; link.setAttribute('download', fileName);
      document.body.appendChild(link); link.click(); link.remove();
    } catch { setError('Download failed'); }
  };

  useEffect(() => {
    if (!shareModal) return;
    const fetchShareData = async () => {
      setSharesLoading(true);
      try {
        const sharesRes = await api.get(`/files/${shareModal.id}/shares`);
        setFileShares(sharesRes.data.shares || []);
        setFileOwner(sharesRes.data.owner);
      } catch { /* silently ignore */ }
      finally { setSharesLoading(false); }
    };
    fetchShareData();
  }, [shareModal]);

  const closeShareModal = () => {
    setShareModal(null); setShareEmail(''); setSharePermission('viewer');
    setFileShares([]); setFileOwner(null);
    setError(''); setSuccess('');
  };

  const handleRevokeShare = async (userId) => {
    if (!shareModal) return;
    try {
      await api.delete(`/files/${shareModal.id}/share/${userId}`);
      const sharesRes = await api.get(`/files/${shareModal.id}/shares`);
      setFileShares(sharesRes.data.shares || []);
    } catch (err) { setError(err.response?.data?.message || 'Failed to revoke access'); }
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

  const handleShare = async (e) => {
  e.preventDefault();
  if (!shareEmail.trim() || !shareModal) return;
  setSharing(true); setError(''); setSuccess('');
  try {
    await api.post(`/files/${shareModal.id}/share`, { granted_to_email: shareEmail.trim(), permission_level: sharePermission });
    setSuccess(`Shared with ${shareEmail.trim()}`);
    setShareEmail(''); setSharePermission('viewer');
    const sharesRes = await api.get(`/files/${shareModal.id}/shares`);
    setFileShares(sharesRes.data.shares || []);
  } catch (err) {
    // No err.response → the request never reached the server (backend down,
    // TLS/cert not trusted, or network). Make that distinct from a real rejection.
    setError(err.response
      ? (err.response.data?.message || err.response.data?.error || 'Share failed')
      : 'Cannot reach the server. Is the backend running?');
  }
  finally { setSharing(false); }
};

  const handleDeleteFile   = (fileId) => api.delete(`/files/${fileId}`);

  const handleSingleDelete = async (fileId) => {
    if (!window.confirm('Delete this file?')) return;
    try { await handleDeleteFile(fileId); setSuccess('File deleted'); fetchData(); }
    catch (err) { setError(err.response?.data?.message || 'Delete failed'); }
  };

  const handleBulkDelete = async () => {
    if (!selectedFiles.length || !window.confirm(`Delete ${selectedFiles.length} selected files?`)) return;
    setDeleting(true); setError('');
    try {
      await Promise.all(selectedFiles.map(id => handleDeleteFile(id)));
      setSuccess(`${selectedFiles.length} files deleted`); setSelectedFiles([]); fetchData();
    } catch { setError('Some files could not be deleted'); }
    finally { setDeleting(false); }
  };

  const handleDeleteFolder = async (folderId) => {
    if (!window.confirm('Delete this folder?')) return;
    try { await api.delete(`/folders/${folderId}`); setSuccess('Folder deleted'); fetchData(); }
    catch (err) { setError(err.response?.data?.message || 'Delete failed'); }
  };

  const toggleFileSelect = (fileId) =>
    setSelectedFiles(prev => prev.includes(fileId) ? prev.filter(id => id !== fileId) : [...prev, fileId]);

  const toggleSelectAll = () =>
    setSelectedFiles(selectedFiles.length === visibleFiles.length ? [] : visibleFiles.map(f => f.id));

  const getBadgeClass = (level) => `badge badge-${level || 'low'}`;
  const formatSize = (bytes) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes/1024).toFixed(1)} KB`;
    return `${(bytes/1048576).toFixed(1)} MB`;
  };

  const currentFolderData = folders.find(f => f.id === currentFolder);
  const currentFolderName = currentFolderData?.name;
  const visibleFolders    = folders.filter(f => String(f.parent_id || '') === String(currentFolder || ''));
  const visibleFiles      = files.filter(f => String(f.folder_id || '') === String(currentFolder || ''));

  const countFilesInFolder = (folderId) => {
    const direct = files.filter(f => String(f.folder_id) === String(folderId)).length;
    const subs   = folders.filter(f => String(f.parent_id) === String(folderId));
    return direct + subs.reduce((sum, sf) => sum + countFilesInFolder(sf.id), 0);
  };
  const allSelected       = visibleFiles.length > 0 && selectedFiles.length === visibleFiles.length;
  const someSelected      = selectedFiles.length > 0;
  const fieldStyle        = { flex: '1', minWidth: '120px' };

  return (
    
    <div>
    {/* Preview modal */}
    {previewFile && (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
        <div style={{ width: '90vw', maxWidth: '960px', height: '88vh', background: '#fff', borderRadius: '16px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.3)' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid #F1F5F9', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#64748B"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/></svg>
              <span style={{ fontSize: '14px', fontWeight: '600', color: '#0F172A' }}>{previewFile.original_name}</span>
            </div>
            <button onClick={closePreview} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', padding: '4px', display: 'flex' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
            </button>
          </div>
          {/* Content */}
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC' }}>
            {previewLoading && <div style={{ color: '#64748B', fontSize: '14px' }}>Loading preview…</div>}
            {!previewLoading && previewUrl && (() => {
              const mime = previewFile.mime_type || '';
              if (mime === 'application/pdf') {
                return <iframe src={previewUrl} style={{ width: '100%', height: '100%', border: 'none' }} title="preview" />;
              }
              if (mime.startsWith('image/')) {
                return <img src={previewUrl} alt={previewFile.original_name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />;
              }
              if (mime.startsWith('text/') || mime === 'application/json') {
                return (
                  <iframe src={previewUrl} style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }} title="preview" />
                );
              }
              return (
                <div style={{ textAlign: 'center', color: '#64748B' }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="#CBD5E1" style={{ marginBottom: '12px' }}><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/></svg>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>Preview not available</div>
                  <div style={{ fontSize: '13px', marginBottom: '16px' }}>This file type cannot be previewed in the browser.</div>
                  <button className="neu-btn-primary" style={{ padding: '8px 20px', fontSize: '13px' }} onClick={() => { closePreview(); handleDownload(previewFile.id, previewFile.original_name); }}>Download instead</button>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    )}
    {shareModal && (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
        <div style={{ width: '480px', maxHeight: '85vh', overflowY: 'auto', background: '#fff', borderRadius: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>

          {/* Header */}
          <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#64748B"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/></svg>
              <div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#0F172A' }}>Share file</div>
                <div style={{ fontSize: '12px', color: '#64748B' }}>{shareModal.original_name}</div>
              </div>
            </div>
            <button onClick={closeShareModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: '4px', display: 'flex', alignItems: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
            </button>
          </div>

          {/* Add people */}
          <div style={{ padding: '16px 24px' }}>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '10px' }}>Add people</div>
            <form onSubmit={handleShare} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input className="neu-input" type="email" placeholder="user@example.com" value={shareEmail} onChange={e => setShareEmail(e.target.value)} autoFocus style={{ flex: 1, padding: '9px 12px', fontSize: '13px', boxSizing: 'border-box' }} />
              <select value={sharePermission} onChange={e => setSharePermission(e.target.value)} style={{ padding: '9px 10px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '12px', color: '#374151', background: '#fff', cursor: 'pointer', flexShrink: 0 }}>
                <option value="viewer">Can download</option>
                <option value="metadata">View only</option>
              </select>
              <button type="submit" disabled={sharing || !shareEmail.trim()} style={{ padding: '9px 16px', borderRadius: '8px', background: '#22C55E', color: '#fff', border: 'none', fontSize: '13px', fontWeight: '600', cursor: sharing || !shareEmail.trim() ? 'not-allowed' : 'pointer', opacity: sharing || !shareEmail.trim() ? 0.6 : 1, flexShrink: 0 }}>
                {sharing ? '…' : 'Add'}
              </button>
            </form>
            {error   && <div style={{ fontSize: '12px', color: '#E11D48', marginTop: '8px' }}>{error}</div>}
            {success && <div style={{ fontSize: '12px', color: '#16A34A', marginTop: '8px' }}>{success}</div>}
          </div>

          {/* Who has access */}
          <div style={{ borderTop: '1px solid #F1F5F9' }}>
            <div style={{ padding: '12px 24px 8px', fontSize: '12px', fontWeight: '600', color: '#374151' }}>Who has access</div>
            {sharesLoading ? (
              <div style={{ padding: '12px 24px', fontSize: '13px', color: '#94A3B8' }}>Loading…</div>
            ) : (
              <div style={{ paddingBottom: '8px' }}>
                {fileOwner && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 24px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#22C55E', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '13px', fontWeight: '700', flexShrink: 0 }}>
                      {(fileOwner.full_name?.[0] || fileOwner.email?.[0] || '?').toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: '500', color: '#0F172A' }}>{fileOwner.full_name} (you)</div>
                      <div style={{ fontSize: '11px', color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileOwner.email}</div>
                    </div>
                    <span style={{ fontSize: '11px', color: '#64748B', flexShrink: 0 }}>Owner</span>
                  </div>
                )}
                {fileShares.map(share => (
                  <div key={share.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 24px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563EB', fontSize: '13px', fontWeight: '700', flexShrink: 0 }}>
                      {(share.full_name?.[0] || share.email?.[0] || '?').toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: '500', color: '#0F172A' }}>{share.full_name}</div>
                      <div style={{ fontSize: '11px', color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{share.email}</div>
                    </div>
                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', fontWeight: '600', flexShrink: 0, background: share.permission_level === 'viewer' ? '#EFF6FF' : '#F8FAFC', color: share.permission_level === 'viewer' ? '#2563EB' : '#64748B', border: `1px solid ${share.permission_level === 'viewer' ? '#BFDBFE' : '#E2E8F0'}` }}>
                      {share.permission_level === 'viewer' ? 'Can download' : 'View only'}
                    </span>
                    <button onClick={() => handleRevokeShare(share.id)} title="Revoke access" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: '4px', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                      onMouseEnter={e => e.currentTarget.style.color = '#E11D48'}
                      onMouseLeave={e => e.currentTarget.style.color = '#94A3B8'}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                    </button>
                  </div>
                ))}
                {fileShares.length === 0 && (
                  <div style={{ padding: '4px 24px 8px', fontSize: '13px', color: '#94A3B8' }}>Not shared with anyone yet.</div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: '12px 24px 20px', borderTop: '1px solid #F1F5F9', display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={closeShareModal} style={{ padding: '9px 24px', borderRadius: '8px', background: '#F8FAFC', color: '#374151', border: '1px solid #E2E8F0', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Done</button>
          </div>
        </div>
      </div>
    )}
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <div style={{ fontSize: '20px', fontWeight: '700', color: '#0F172A', letterSpacing: '-0.3px' }}>My Files</div>
          <div style={{ fontSize: '13px', color: '#64748B', marginTop: '3px' }}>
            {currentFolder ? (
              <span>
                <span style={{ cursor: 'pointer', color: '#22C55E', fontWeight: '500' }} onClick={() => { setCurrentFolder(null); setSelectedFiles([]); }}>Root</span>
                {' / '}{currentFolderName}
              </span>
            ) : 'All your files and folders'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {someSelected && canDelete && (
            <button className="neu-btn" onClick={handleBulkDelete} disabled={deleting} style={{ color: '#DC2626', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
              {deleting ? 'Deleting…' : `Delete ${selectedFiles.length}`}
            </button>
          )}
          {canUpload && (
            <>
              <button className="neu-btn" onClick={() => { setShowNewFolder(!showNewFolder); setShowUpload(false); }} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>
                New Folder
              </button>
              <button className="neu-btn-primary" onClick={() => { setShowUpload(!showUpload); setShowNewFolder(false); }} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                Upload
              </button>
            </>
          )}
        </div>
      </div>

      {error   && <div className="error-box">{error}</div>}
      {success && !uploading && <div className="success-box">{success}</div>}

      {/* New Folder Form */}
      {showNewFolder && (
        <div className="neu-raised" style={{ padding: '20px', marginBottom: '16px' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#0F172A', marginBottom: '12px' }}>Create new folder</div>
          <form onSubmit={handleCreateFolder} style={{ display: 'flex', gap: '10px' }}>
            <input className="neu-input" type="text" placeholder="Folder name…" value={newFolderName} onChange={e => setNewFolderName(e.target.value)} autoFocus required style={{ flex: 1 }} />
            <button className="neu-btn-primary" type="submit">Create</button>
            <button className="neu-btn" type="button" onClick={() => setShowNewFolder(false)}>Cancel</button>
          </form>
        </div>
      )}

      {/* Upload Form */}
      {showUpload && (
        <div className="neu-raised" style={{ padding: '20px', marginBottom: '16px' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#0F172A', marginBottom: '16px' }}>
            Upload {currentFolder ? `to "${currentFolderName}"` : 'to root'}
          </div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            {['file','folder'].map(mode => (
              <button key={mode} type="button" className={uploadMode === mode ? 'neu-btn-primary' : 'neu-btn'} onClick={() => setUploadMode(mode)} style={{ fontSize: '12px', padding: '7px 16px' }}>
                {mode === 'file' ? 'Single File' : 'Entire Folder'}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="neu-pressed" style={{ flex: '2', minWidth: '180px', padding: '11px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', color: uploadForm.file ? '#0F172A' : '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>
                {uploadMode === 'folder' ? (uploading ? success : 'Choose folder…') : (uploadForm.file ? uploadForm.file.name : 'Choose file…')}
              </span>
              {uploadMode === 'file' ? (
                <label style={{ fontSize: '12px', color: '#22C55E', fontWeight: '600', cursor: 'pointer', flexShrink: 0 }}>
                  Browse
                  <input type="file" style={{ display: 'none' }} onChange={e => setUploadForm({ ...uploadForm, file: e.target.files[0] })} />
                </label>
              ) : (
                <label style={{ fontSize: '12px', color: '#22C55E', fontWeight: '600', cursor: uploading ? 'not-allowed' : 'pointer', flexShrink: 0 }}>
                  Browse
                  <input type="file" style={{ display: 'none' }} webkitdirectory="true" directory="true" multiple onChange={handleFolderUpload} disabled={uploading} />
                </label>
              )}
            </div>
            <select className="neu-input" style={fieldStyle} value={uploadForm.sensitivity_level} onChange={e => setUploadForm({ ...uploadForm, sensitivity_level: e.target.value })}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="confidential">Confidential</option>
            </select>
            <select className="neu-input" style={fieldStyle} value={uploadForm.department || ''} onChange={e => setUploadForm({ ...uploadForm, department: e.target.value })}>
              <option value="">Department</option>
              {['IT','Finance','Marketing','HR','Operations'].map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <input className="neu-input" style={fieldStyle} type="text" placeholder="Project tag" value={uploadForm.project_category} onChange={e => setUploadForm({ ...uploadForm, project_category: e.target.value })} />
            {uploadMode === 'file' && (
              <button className="neu-btn-primary" type="button" disabled={uploading} onClick={handleUpload} style={{ whiteSpace: 'nowrap', padding: '11px 20px' }}>
                {uploading ? 'Encrypting…' : 'Upload'}
              </button>
            )}
            <button className="neu-btn" type="button" onClick={() => setShowUpload(false)}>Cancel</button>
          </div>
          {uploading && uploadMode === 'folder' && (
            <div style={{ marginTop: '12px' }}>
              <div className="neu-pressed" style={{ padding: '10px 16px' }}>
                <div style={{ fontSize: '12px', color: '#22C55E', fontWeight: '500' }}>{success}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="neu-raised" style={{ padding: '60px', textAlign: 'center' }}>
          <div style={{ fontSize: '13px', color: '#94A3B8' }}>Loading…</div>
        </div>
      ) : visibleFolders.length === 0 && visibleFiles.length === 0 ? (
        <div style={{ padding: '60px', textAlign: 'center', background: '#FFFFFF', borderRadius: '12px', border: '2px dashed #E2E8F0' }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5" style={{ margin: '0 auto 12px', display: 'block' }}>
            <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
          </svg>
          <div style={{ fontSize: '13px', color: '#94A3B8' }}>{currentFolder ? 'This folder is empty' : 'No files or folders yet'}</div>
        </div>
      ) : (
        <div>
          {/* Folders grid */}
          {visibleFolders.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '11px', fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>Folders</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(156px, 1fr))', gap: '12px' }}>
                {visibleFolders.map(folder => (
                  <div key={folder.id} className="neu-raised" style={{ padding: '16px', cursor: 'pointer', position: 'relative' }} onClick={() => { setCurrentFolder(folder.id); setSelectedFiles([]); }}>
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="#DBEAFE" stroke="#3B82F6" strokeWidth="1.5" style={{ marginBottom: '10px', display: 'block' }}>
                      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
                    </svg>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{folder.name}</div>
                    <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '3px' }}>{countFilesInFolder(folder.id)} files</div>
                    {canDelete && (
                      <button className="neu-btn" onClick={e => { e.stopPropagation(); handleDeleteFolder(folder.id); }} style={{ position: 'absolute', top: '8px', right: '8px', padding: '2px 7px', fontSize: '13px', color: '#DC2626', border: 'none', background: 'transparent' }}>×</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Files table */}
          {visibleFiles.length > 0 && (
            <div>
              <div style={{ fontSize: '11px', fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>Files</div>
              <div className="neu-raised" style={{ padding: '0', overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: canDelete ? '36px 2fr 1fr 1fr 1fr 1fr 1.8fr' : '2fr 1fr 1fr 1fr 1fr 1.8fr', gap: '8px', padding: '12px 20px', borderBottom: '1px solid #F1F5F9', alignItems: 'center' }}>
                  {canDelete && (
                    <div style={{ width: '18px', height: '18px', borderRadius: '5px', border: '1.5px solid #CBD5E1', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: allSelected ? '#22C55E' : 'transparent', flexShrink: 0 }} onClick={toggleSelectAll}>
                      {allSelected && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                    </div>
                  )}
                  {['File name','Sensitivity','Department','Project','Size','Actions'].map(h => (
                    <div key={h} style={{ fontSize: '11px', fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</div>
                  ))}
                </div>
                <div>
                  {visibleFiles.map((file, idx) => {
                    const isSelected    = selectedFiles.includes(file.id);
                    const isOwner       = file.owner_email === user?.email;
                    // A Department Manager has authority over every file owned by a
                    // member of their department; a Project Manager over every file
                    // tagged with the project they manage. The API only lists files
                    // within scope, but we mirror the backend rule here precisely.
                    const isDeptManager  = user?.role === 'Department Manager';
                    const inManagedProj  =
                      user?.role === 'Project Manager' &&
                      user?.managed_project &&
                      file.project_category &&
                      file.project_category.trim().toLowerCase() === user.managed_project.trim().toLowerCase();
                    const canActOnThis  = isOwner || isDeptManager || inManagedProj;
                    const canDeleteThis = canDelete && canActOnThis;
                    return (
                      <div key={file.id} style={{ display: 'grid', gridTemplateColumns: canDelete ? '36px 2fr 1fr 1fr 1fr 1fr 1.8fr' : '2fr 1fr 1fr 1fr 1fr 1.8fr', gap: '8px', padding: '14px 20px', alignItems: 'center', borderBottom: idx < visibleFiles.length - 1 ? '1px solid #F8FAFC' : 'none', background: isSelected ? '#F0FDF4' : 'transparent', transition: 'background 0.15s' }}>
                        {canDelete && (
                          <div style={{ width: '18px', height: '18px', borderRadius: '5px', border: `1.5px solid ${isSelected ? '#22C55E' : '#CBD5E1'}`, cursor: canDeleteThis ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isSelected ? '#22C55E' : 'transparent', opacity: canDeleteThis ? 1 : 0.3, flexShrink: 0 }} onClick={() => canDeleteThis && toggleFileSelect(file.id)}>
                            {isSelected && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                          </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                          <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                          </div>
                          <span style={{ fontSize: '13px', fontWeight: '500', color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.original_name}</span>
                        </div>
                        <div><span className={getBadgeClass(file.sensitivity_level)}>{file.sensitivity_level}</span></div>
                        <div style={{ fontSize: '12px', color: '#64748B' }}>{file.department || '—'}</div>
                        <div style={{ fontSize: '12px', color: '#64748B' }}>{file.project_category || '—'}</div>
                        <div style={{ fontSize: '12px', color: '#64748B' }}>{formatSize(file.size_bytes)}</div>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'nowrap' }}>
                          {canActOnThis && (
                            <button className="neu-btn" style={{ padding: '5px 8px', fontSize: '11px', whiteSpace: 'nowrap' }} onClick={() => handlePreview(file)}>Preview</button>
                          )}
                          {canActOnThis && (
                            <button className="neu-btn" style={{ padding: '5px 8px', fontSize: '11px', whiteSpace: 'nowrap' }} onClick={() => handleDownload(file.id, file.original_name)}>Download</button>
                          )}
                          {!canActOnThis && (
                            <span style={{ fontSize: '11px', color: '#94A3B8' }}>View only</span>
                          )}
                          {canShare && canActOnThis && (
                            <button className="neu-btn" style={{ padding: '5px 8px', fontSize: '11px', whiteSpace: 'nowrap', color: '#2563EB' }} onClick={() => { setShareModal(file); setShareEmail(''); }}>Share</button>
                          )}
                          {canDeleteThis && (
                            <button className="neu-btn" style={{ padding: '5px 8px', fontSize: '11px', whiteSpace: 'nowrap', color: '#DC2626' }} onClick={() => handleSingleDelete(file.id)}>Delete</button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {someSelected && (
                  <div style={{ padding: '14px 20px', background: '#F0FDF4', borderTop: '1px solid #BBF7D0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: '13px', color: '#16A34A', fontWeight: '600' }}>{selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected</div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="neu-btn" style={{ fontSize: '12px', padding: '7px 14px' }} onClick={() => setSelectedFiles([])}>Clear</button>
                      <button className="neu-btn" style={{ fontSize: '12px', padding: '7px 14px', color: '#DC2626' }} onClick={handleBulkDelete} disabled={deleting}>
                        {deleting ? 'Deleting…' : `Delete ${selectedFiles.length}`}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MyFiles;