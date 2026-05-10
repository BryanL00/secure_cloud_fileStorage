import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const MyFiles = () => {
  const { user } = useAuth();
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [uploadMode, setUploadMode] = useState('file');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    file: null,
    sensitivity_level: 'low',
    project_category: '',
    department: ''
  });

  const canUpload = ['Manager', 'User'].includes(user?.role);
  const canDelete = ['Manager', 'User'].includes(user?.role);

  const fetchData = async () => {
    try {
      const [filesRes, foldersRes] = await Promise.all([
        api.get('/files'),
        api.get('/folders')
      ]);
      setFiles(filesRes.data.files);
      setFolders(foldersRes.data.folders);
    } catch (err) {
      setError('Failed to load files');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      await api.post('/folders', {
        name: newFolderName,
        parent_id: currentFolder || null
      });
      setSuccess('Folder created');
      setNewFolderName('');
      setShowNewFolder(false);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create folder');
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadForm.file) return;
    setUploading(true);
    setError('');
    setSuccess('');
    const formData = new FormData();
    formData.append('file', uploadForm.file);
    formData.append('sensitivity_level', uploadForm.sensitivity_level);
    formData.append('project_category', uploadForm.project_category);
    formData.append('department', uploadForm.department || '');
    if (currentFolder) formData.append('folder_id', currentFolder);
    try {
      await api.post('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setSuccess('File encrypted and uploaded');
      setUploadForm({ file: null, sensitivity_level: 'low', project_category: '', department: '' });
      setShowUpload(false);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleFolderUpload = async (e) => {
    const fileList = Array.from(e.target.files);
    if (fileList.length === 0) return;
    setUploading(true);
    setError('');
    setSuccess('');
    try {
      const folderIdMap = {};
      const rootFolderName = fileList[0].webkitRelativePath.split('/')[0];
      const rootRes = await api.post('/folders', {
        name: rootFolderName,
        parent_id: currentFolder || null
      });
      folderIdMap[rootFolderName] = rootRes.data.folder.id;

      const subPaths = new Set();
      fileList.forEach(file => {
        const parts = file.webkitRelativePath.split('/');
        for (let i = 2; i < parts.length; i++) {
          subPaths.add(parts.slice(0, i).join('/'));
        }
      });

      const sortedPaths = Array.from(subPaths)
        .sort((a, b) => a.split('/').length - b.split('/').length);

      for (const path of sortedPaths) {
        const parts = path.split('/');
        const name = parts[parts.length - 1];
        const parentPath = parts.slice(0, -1).join('/');
        const parentId = folderIdMap[parentPath];
        const res = await api.post('/folders', {
          name, parent_id: parentId || null
        });
        folderIdMap[path] = res.data.folder.id;
      }

      let uploaded = 0;
      for (const file of fileList) {
        const parts = file.webkitRelativePath.split('/');
        const fileFolderPath = parts.slice(0, -1).join('/');
        const folderId = folderIdMap[fileFolderPath] || currentFolder || null;
        const formData = new FormData();
        formData.append('file', file);
        formData.append('sensitivity_level', uploadForm.sensitivity_level);
        formData.append('project_category', uploadForm.project_category);
        formData.append('department', uploadForm.department || '');
        if (folderId) formData.append('folder_id', folderId);
        await api.post('/files/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        uploaded++;
        setSuccess(`Uploading... ${uploaded}/${fileList.length} files`);
      }
      setSuccess(`Successfully uploaded ${fileList.length} files`);
      setShowUpload(false);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Folder upload failed');
    } finally {
      setUploading(false);
    }
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

  const handleDeleteFile = async (fileId) => {
  await api.delete(`/files/${fileId}`);
};

  // Single file delete
  const handleSingleDelete = async (fileId) => {
    if (!window.confirm('Delete this file?')) return;
    try {
      await handleDeleteFile(fileId);
      setSuccess('File deleted');
      fetchData();
    } catch (err) {
      setError('Delete failed');
    }
  };

  // Multi-select delete
  const handleBulkDelete = async () => {
    if (selectedFiles.length === 0) return;
    if (!window.confirm(`Delete ${selectedFiles.length} selected files?`)) return;
    setDeleting(true);
    setError('');
    try {
      await Promise.all(selectedFiles.map(id => handleDeleteFile(id)));
      setSuccess(`${selectedFiles.length} files deleted`);
      setSelectedFiles([]);
      fetchData();
    } catch (err) {
      setError('Some files could not be deleted');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteFolder = async (folderId) => {
    if (!window.confirm('Delete this folder?')) return;
    try {
      await api.delete(`/folders/${folderId}`);
      setSuccess('Folder deleted');
      fetchData();
    } catch (err) {
      setError('Delete failed');
    }
  };

  const toggleFileSelect = (fileId) => {
    setSelectedFiles(prev =>
      prev.includes(fileId)
        ? prev.filter(id => id !== fileId)
        : [...prev, fileId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedFiles.length === visibleFiles.length) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles(visibleFiles.map(f => f.id));
    }
  };

  const getBadgeClass = (level) => {
    const map = {
      low: 'badge-low', medium: 'badge-medium',
      high: 'badge-high', confidential: 'badge-confidential'
    };
    return `badge ${map[level] || 'badge-low'}`;
  };

  const formatSize = (bytes) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const currentFolderData = folders.find(f => f.id === currentFolder);
  const currentFolderName = currentFolderData?.name;
  const visibleFolders = folders.filter(f =>
    String(f.parent_id || '') === String(currentFolder || '')
  );
  const visibleFiles = files.filter(f =>
    String(f.folder_id || '') === String(currentFolder || '')
  );

  const allSelected = visibleFiles.length > 0 && selectedFiles.length === visibleFiles.length;
  const someSelected = selectedFiles.length > 0;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <div style={{ fontSize: '20px', fontWeight: '600', color: '#4A5568' }}>My Files</div>
          <div style={{ fontSize: '13px', color: '#8896A5', marginTop: '2px' }}>
            {currentFolder ? (
              <span>
                <span style={{ cursor: 'pointer', color: '#5B6EAE' }}
                  onClick={() => { setCurrentFolder(null); setSelectedFiles([]); }}>
                  Root
                </span>
                {' / '}{currentFolderName}
              </span>
            ) : 'All your files and folders'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {/* Bulk delete button */}
          {someSelected && canDelete && (
            <button
              className="neu-btn"
              onClick={handleBulkDelete}
              disabled={deleting}
              style={{
                color: '#A05070',
                display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/>
              </svg>
              {deleting ? 'Deleting...' : `Delete ${selectedFiles.length} selected`}
            </button>
          )}

          {canUpload && (
            <>
              <button
                className="neu-btn"
                onClick={() => { setShowNewFolder(!showNewFolder); setShowUpload(false); }}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
                  <line x1="12" y1="11" x2="12" y2="17"/>
                  <line x1="9" y1="14" x2="15" y2="14"/>
                </svg>
                New Folder
              </button>
              <button
                className="neu-btn-primary"
                onClick={() => { setShowUpload(!showUpload); setShowNewFolder(false); }}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                Upload
              </button>
            </>
          )}
        </div>
      </div>

      {error && <div className="error-box">{error}</div>}
      {success && !uploading && <div className="success-box">{success}</div>}

      {/* New Folder Form */}
      {showNewFolder && (
        <div className="neu-raised" style={{ padding: '20px', marginBottom: '16px' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#4A5568', marginBottom: '12px' }}>
            Create new folder
          </div>
          <form onSubmit={handleCreateFolder} style={{ display: 'flex', gap: '10px' }}>
            <input
              className="neu-input"
              type="text"
              placeholder="Folder name..."
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              autoFocus
              required
              style={{ flex: 1 }}
            />
            <button className="neu-btn-primary" type="submit">Create</button>
            <button className="neu-btn" type="button" onClick={() => setShowNewFolder(false)}>Cancel</button>
          </form>
        </div>
      )}

      {/* Upload Form */}
      {showUpload && (
        <div className="neu-raised" style={{ padding: '20px', marginBottom: '16px' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#4A5568', marginBottom: '16px' }}>
            Upload {currentFolder ? `to "${currentFolderName}"` : 'to root'}
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <button type="button"
              className={uploadMode === 'file' ? 'neu-btn-primary' : 'neu-btn'}
              onClick={() => setUploadMode('file')}
              style={{ fontSize: '12px', padding: '8px 16px' }}>
              Single File
            </button>
            <button type="button"
              className={uploadMode === 'folder' ? 'neu-btn-primary' : 'neu-btn'}
              onClick={() => setUploadMode('folder')}
              style={{ fontSize: '12px', padding: '8px 16px' }}>
              Entire Folder
            </button>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="neu-pressed" style={{
              flex: '2', minWidth: '180px', padding: '12px 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <span style={{ fontSize: '13px', color: uploadForm.file ? '#4A5568' : '#8896A5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>
                {uploadMode === 'folder'
                  ? (uploading ? success : 'Choose folder...')
                  : (uploadForm.file ? uploadForm.file.name : 'Choose file...')}
              </span>
              {uploadMode === 'file' ? (
                <label style={{ fontSize: '12px', color: '#5B6EAE', fontWeight: '500', cursor: 'pointer', flexShrink: 0 }}>
                  Browse
                  <input type="file" style={{ display: 'none' }}
                    onChange={e => setUploadForm({ ...uploadForm, file: e.target.files[0] })} />
                </label>
              ) : (
                <label style={{ fontSize: '12px', color: '#5B6EAE', fontWeight: '500', cursor: uploading ? 'not-allowed' : 'pointer', flexShrink: 0 }}>
                  Browse
                  <input type="file" style={{ display: 'none' }}
                    webkitdirectory="true" directory="true" multiple
                    onChange={handleFolderUpload} disabled={uploading} />
                </label>
              )}
            </div>

            <select className="neu-input" style={{ flex: '1', minWidth: '120px' }}
              value={uploadForm.sensitivity_level}
              onChange={e => setUploadForm({ ...uploadForm, sensitivity_level: e.target.value })}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="confidential">Confidential</option>
            </select>

            <select className="neu-input" style={{ flex: '1', minWidth: '120px' }}
              value={uploadForm.department || ''}
              onChange={e => setUploadForm({ ...uploadForm, department: e.target.value })}>
              <option value="">Department</option>
              <option value="IT">IT</option>
              <option value="Finance">Finance</option>
              <option value="Marketing">Marketing</option>
              <option value="HR">HR</option>
              <option value="Operations">Operations</option>
            </select>

            <input className="neu-input" style={{ flex: '1', minWidth: '120px' }}
              type="text" placeholder="Project tag"
              value={uploadForm.project_category}
              onChange={e => setUploadForm({ ...uploadForm, project_category: e.target.value })} />

            {uploadMode === 'file' && (
              <button className="neu-btn-primary" type="button" disabled={uploading}
                onClick={handleUpload}
                style={{ whiteSpace: 'nowrap', padding: '12px 20px' }}>
                {uploading ? 'Encrypting...' : 'Upload'}
              </button>
            )}

            <button className="neu-btn" type="button" onClick={() => setShowUpload(false)}>
              Cancel
            </button>
          </div>

          {uploading && uploadMode === 'folder' && (
            <div style={{ marginTop: '12px' }}>
              <div className="neu-pressed" style={{ padding: '10px 16px' }}>
                <div style={{ fontSize: '12px', color: '#5B6EAE' }}>{success}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="neu-raised" style={{ padding: '60px', textAlign: 'center' }}>
          <div style={{ fontSize: '13px', color: '#8896A5' }}>Loading...</div>
        </div>
      ) : visibleFolders.length === 0 && visibleFiles.length === 0 ? (
        <div className="neu-pressed" style={{ padding: '60px', textAlign: 'center', borderRadius: '16px' }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#b8bec7" strokeWidth="1.5"
            style={{ margin: '0 auto 12px', display: 'block' }}>
            <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
          </svg>
          <div style={{ fontSize: '13px', color: '#8896A5' }}>
            {currentFolder ? 'This folder is empty' : 'No files or folders yet'}
          </div>
        </div>
      ) : (
        <div>
          {/* Folders */}
          {visibleFolders.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '11px', fontWeight: '600', color: '#8896A5', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
                Folders
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
                {visibleFolders.map(folder => (
                  <div key={folder.id} className="neu-raised"
                    style={{ padding: '16px', cursor: 'pointer', position: 'relative' }}
                    onClick={() => { setCurrentFolder(folder.id); setSelectedFiles([]); }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="#5B6EAE"
                      stroke="#5B6EAE" strokeWidth="1" style={{ marginBottom: '8px', opacity: 0.7 }}>
                      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
                    </svg>
                    <div style={{ fontSize: '12px', fontWeight: '500', color: '#4A5568', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {folder.name}
                    </div>
                    <div style={{ fontSize: '10px', color: '#8896A5', marginTop: '2px' }}>
                      {files.filter(f => String(f.folder_id) === String(folder.id)).length} files
                    </div>
                    {canDelete && (
                      <button className="neu-btn"
                        onClick={e => { e.stopPropagation(); handleDeleteFolder(folder.id); }}
                        style={{ position: 'absolute', top: '8px', right: '8px', padding: '3px 7px', fontSize: '12px', color: '#A05070' }}>
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Files */}
          {visibleFiles.length > 0 && (
            <div>
              <div style={{ fontSize: '11px', fontWeight: '600', color: '#8896A5', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
                Files
              </div>
              <div className="neu-raised" style={{ padding: '20px' }}>

                {/* Table Header with Select All */}
                <div style={{ display: 'grid', gridTemplateColumns: canDelete ? '36px 2fr 1fr 1fr 1fr 1fr 1.2fr' : '2fr 1fr 1fr 1fr 1fr 1.2fr', gap: '8px', padding: '8px 16px', marginBottom: '8px', alignItems: 'center' }}>
                  {canDelete && (
                    <div
                      className="neu-pressed"
                      style={{
                        width: '20px', height: '20px', borderRadius: '6px',
                        cursor: 'pointer', display: 'flex', alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      onClick={toggleSelectAll}
                    >
                      {allSelected && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#5B6EAE" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                    </div>
                  )}
                  {['File name', 'Sensitivity', 'Department', 'Project', 'Size', 'Actions'].map(h => (
                    <div key={h} style={{ fontSize: '11px', fontWeight: '600', color: '#8896A5', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</div>
                  ))}
                </div>

                {/* File Rows */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {visibleFiles.map(file => {
                    const isSelected = selectedFiles.includes(file.id);
                    const isOwner = file.owner_email === user?.email;
                    const canDeleteThis = canDelete && isOwner;

                    return (
                      <div key={file.id} className="neu-raised" style={{
                        display: 'grid',
                        gridTemplateColumns: canDelete ? '36px 2fr 1fr 1fr 1fr 1fr 1.2fr' : '2fr 1fr 1fr 1fr 1fr 1.2fr',
                        gap: '8px', padding: '12px 16px', alignItems: 'center',
                        outline: isSelected ? '2px solid #5B6EAE' : 'none',
                        borderRadius: '16px'
                      }}>
                        {canDelete && (
                          <div
                            className={isSelected ? 'neu-pressed' : 'neu-raised'}
                            style={{
                              width: '20px', height: '20px', borderRadius: '6px',
                              cursor: canDeleteThis ? 'pointer' : 'not-allowed',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              opacity: canDeleteThis ? 1 : 0.3
                            }}
                            onClick={() => canDeleteThis && toggleFileSelect(file.id)}
                          >
                            {isSelected && (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#5B6EAE" strokeWidth="3">
                                <polyline points="20 6 9 17 4 12"/>
                              </svg>
                            )}
                          </div>
                        )}

                        <div style={{ fontSize: '13px', fontWeight: '500', color: '#4A5568', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {file.original_name}
                        </div>
                        <div>
                          <span className={getBadgeClass(file.sensitivity_level)}>
                            {file.sensitivity_level}
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#8896A5' }}>
                          {file.department || '—'}
                        </div>
                        <div style={{ fontSize: '12px', color: '#8896A5' }}>
                          {file.project_category || '—'}
                        </div>
                        <div style={{ fontSize: '12px', color: '#8896A5' }}>
                          {formatSize(file.size_bytes)}
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button className="neu-btn" style={{ padding: '6px 10px', fontSize: '11px' }}
                            onClick={() => handleDownload(file.id, file.original_name)}>
                            Download
                          </button>
                          {canDeleteThis && (
                            <button className="neu-btn" style={{ padding: '6px 10px', fontSize: '11px', color: '#A05070' }}
                              onClick={() => handleSingleDelete(file.id)}>
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Bulk action bar */}
                {someSelected && (
                  <div style={{
                    marginTop: '16px', padding: '12px 16px',
                    background: '#E0E5EC',
                    boxShadow: 'inset 3px 3px 6px #b8bec7, inset -3px -3px 6px #ffffff',
                    borderRadius: '12px',
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div style={{ fontSize: '13px', color: '#5B6EAE', fontWeight: '500' }}>
                      {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="neu-btn" style={{ fontSize: '12px', padding: '8px 14px' }}
                        onClick={() => setSelectedFiles([])}>
                        Clear selection
                      </button>
                      <button className="neu-btn" style={{ fontSize: '12px', padding: '8px 14px', color: '#A05070' }}
                        onClick={handleBulkDelete} disabled={deleting}>
                        {deleting ? 'Deleting...' : `Delete ${selectedFiles.length} files`}
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