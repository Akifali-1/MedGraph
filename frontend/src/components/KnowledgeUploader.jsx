import { useCallback, useEffect, useState } from 'react';
import { 
  UploadCloud, 
  FileText, 
  Database, 
  Trash2, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  Sparkles
} from 'lucide-react';
import { getApiUrl } from '../config';

export default function KnowledgeUploader() {
  const [documents, setDocuments] = useState([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [docError, setDocError] = useState(null);

  // File Upload states
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [uploadStatus, setUploadStatus] = useState('idle'); // 'idle' | 'uploading' | 'processing' | 'success' | 'error'
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState(null);
  const [detectedRoute, setDetectedRoute] = useState(null); // 'guideline' | 'structured' | null
  const [validationWarning, setValidationWarning] = useState(null);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('medgraph_access_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchDocuments = useCallback(async () => {
    setIsLoadingDocs(true);
    setDocError(null);
    try {
      const response = await fetch(getApiUrl('/knowledge/documents'), {
        headers: getAuthHeaders()
      });
      if (!response.ok) {
        throw new Error('Failed to retrieve indexed documents list.');
      }
      const data = await response.json();
      setDocuments(data);
    } catch (error) {
      setDocError(error.message);
    } finally {
      setIsLoadingDocs(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => fetchDocuments(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchDocuments]);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const validateCsvHeader = (selectedFile) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target.result;
          const firstLine = text.split('\n')[0].toLowerCase();
          const headers = firstLine.split(',').map(h => h.trim());
          const required = ['drug1', 'drug2', 'severity', 'effect'];
          const missing = required.filter(r => !headers.includes(r));
          if (missing.length > 0) {
            resolve({
              valid: false,
              warning: `CSV lacks required column headers: ${missing.join(', ')}`
            });
          } else {
            resolve({ valid: true });
          }
        } catch {
          resolve({ valid: false, warning: "Unable to parse CSV structure." });
        }
      };
      // Read first 2KB of CSV
      reader.readAsText(selectedFile.slice(0, 2048));
    });
  };

  const handleFileChange = async (selectedFile) => {
    if (!selectedFile) return;
    setFile(selectedFile);
    setTitle(selectedFile.name.replace(/\.[^/.]+$/, "")); // Strip extension for default title
    setUploadStatus('idle');
    setUploadProgress(0);
    setUploadError(null);
    setValidationWarning(null);

    const ext = selectedFile.name.split('.').pop().toLowerCase();
    if (ext === 'pdf' || ext === 'txt') {
      setDetectedRoute('guideline');
    } else if (ext === 'csv') {
      setDetectedRoute('structured');
      const csvCheck = await validateCsvHeader(selectedFile);
      if (!csvCheck.valid) {
        setValidationWarning(csvCheck.warning);
      }
    } else {
      setDetectedRoute(null);
      setUploadError("Unsupported file type. Please upload a .pdf, .txt, or .csv file.");
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleUploadSubmit = (e) => {
    e.preventDefault();
    if (!file || !detectedRoute) return;

    setUploadStatus('uploading');
    setUploadProgress(0);
    setUploadError(null);

    const formData = new FormData();
    let uploadUrl = '';

    if (detectedRoute === 'guideline') {
      formData.append('file', file);
      if (title.trim()) {
        formData.append('title', title.trim());
      }
      uploadUrl = getApiUrl('/knowledge/upload/guidelines');
    } else if (detectedRoute === 'structured') {
      formData.append('file', file);
      uploadUrl = getApiUrl('/knowledge/upload/structured');
    }

    const xhr = new XMLHttpRequest();
    xhr.open('POST', uploadUrl, true);
    const token = localStorage.getItem('medgraph_access_token');
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    // Track upload progress
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        setUploadProgress(percent);
        if (percent === 100) {
          setUploadStatus('processing');
        }
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        setUploadStatus('success');
        setFile(null);
        setTitle('');
        setDetectedRoute(null);
        fetchDocuments(); // Refresh documents table
      } else {
        setUploadStatus('error');
        try {
          const res = JSON.parse(xhr.responseText);
          setUploadError(res.detail || "Server failed to process document.");
        } catch {
          setUploadError("An error occurred during file ingestion.");
        }
      }
    };

    xhr.onerror = () => {
      setUploadStatus('error');
      setUploadError("Network connection error. Check if backend is running.");
    };

    xhr.send(formData);
  };

  const handleDeleteDoc = async (docId) => {
    if (!confirm("Are you sure you want to delete this custom guideline? This will remove all associated vector embeddings from semantic RAG index.")) {
      return;
    }
    
    try {
      const response = await fetch(getApiUrl(`/knowledge/documents/${docId}`), {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (!response.ok) {
        throw new Error('Failed to delete the document.');
      }
      fetchDocuments();
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const formatDateTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleString();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      {/* Upload Zone Panel */}
      <div className="clinical-card" style={{ padding: '28px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-contrast)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <Sparkles size={16} style={{ color: 'var(--accent-cyan)' }} />
          Add documents
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: '1.4' }}>
          Add a PDF or TXT source, or a CSV with medicine interactions.
        </p>

        <form onSubmit={handleUploadSubmit} onDragEnter={handleDrag}>
          {/* Drag and Drop Zone */}
          <div 
            className={`file-drop-zone ${dragActive ? 'drag-active' : ''} ${file ? 'file-selected' : ''}`}
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => document.getElementById('file-input-element').click()}
            style={{ minHeight: '180px' }}
          >
            <input 
              id="file-input-element" 
              type="file" 
              style={{ display: 'none' }} 
              accept=".pdf,.txt,.csv"
              onChange={(e) => handleFileChange(e.target.files[0])}
            />

            {!file ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <div className="drop-icon-wrapper">
                  <UploadCloud size={26} style={{ color: 'var(--accent-cyan)' }} />
                </div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-contrast)' }}>
                  Drag & drop clinical files or <span style={{ color: 'var(--accent-cyan)', textDecoration: 'underline', cursor: 'pointer' }}>browse system files</span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  PDF / TXT for sources · CSV for medicine interactions
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px', width: '100%', maxWidth: '500px', margin: '0 auto', justifyContent: 'center' }}>
                <div className="drop-icon-wrapper" style={{ background: detectedRoute === 'guideline' ? 'rgba(129, 140, 248, 0.1)' : 'rgba(16, 185, 129, 0.1)', border: detectedRoute === 'guideline' ? '1px solid rgba(129, 140, 248, 0.2)' : '1px solid rgba(16, 185, 129, 0.2)' }}>
                  {detectedRoute === 'guideline' ? (
                    <FileText size={24} style={{ color: 'var(--accent-purple)' }} />
                  ) : (
                    <Database size={24} style={{ color: 'var(--accent-emerald)' }} />
                  )}
                </div>
                <div style={{ textAlign: 'left', flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-contrast)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {file.name}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Size: <span style={{ fontFamily: 'var(--font-mono)' }}>{(file.size / 1024).toFixed(1)} KB</span> | Pipeline: {' '}
                    {detectedRoute === 'guideline' ? (
                      <span className="badge badge-purple" style={{ fontSize: '10px', padding: '1px 6px' }}>Pinecone</span>
                    ) : (
                      <span className="badge badge-emerald" style={{ fontSize: '10px', padding: '1px 6px' }}>Neo4j</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Form details when file is loaded */}
          {file && detectedRoute && (
            <div style={{ marginTop: '24px', borderTop: '1px solid var(--panel-border)', paddingTop: '20px' }}>
              {detectedRoute === 'guideline' && (
                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label className="form-label">Guideline Citation Title (For differential analysis matching)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. AHA/ACC Chest Pain Guidelines 2021"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>
              )}

              {validationWarning && (
                <div className="triage-banner warning" style={{ fontSize: '12px', marginBottom: '20px', padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong style={{ display: 'block', marginBottom: '4px' }}>File Header Notice</strong>
                    {validationWarning}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => { setFile(null); setDetectedRoute(null); setValidationWarning(null); }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={uploadStatus === 'uploading' || uploadStatus === 'processing'}
                >
                  Upload file
                </button>
              </div>
            </div>
          )}
        </form>

        {/* Ingest Progress Status */}
        {(uploadStatus === 'uploading' || uploadStatus === 'processing') && (
          <div style={{ marginTop: '24px', padding: '18px', background: 'rgba(14, 165, 233, 0.03)', border: '1px solid rgba(14, 165, 233, 0.15)', borderRadius: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '8px' }}>
              <span style={{ color: 'var(--text-contrast)', fontWeight: '700' }}>
                {uploadStatus === 'uploading' ? "Uploading file..." : "Preparing file..."}
              </span>
              <span style={{ color: 'var(--accent-cyan)', fontWeight: '700', fontFamily: 'var(--font-mono)' }}>{uploadProgress}%</span>
            </div>
            <div className="confidence-slider-bg" style={{ height: '8px' }}>
              <div 
                className="confidence-slider-fill" 
                style={{ width: `${uploadProgress}%`, height: '8px', backgroundColor: 'var(--accent-cyan)' }}
              ></div>
            </div>
          </div>
        )}

        {uploadStatus === 'success' && (
          <div className="triage-banner" style={{ background: 'rgba(16, 185, 129, 0.05)', borderColor: 'rgba(16, 185, 129, 0.2)', color: 'var(--accent-emerald)', marginTop: '24px', display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 18px', borderRadius: '10px' }}>
            <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
            <div style={{ fontSize: '13px' }}>
              <strong>Upload complete:</strong> Source added.
            </div>
          </div>
        )}

        {uploadStatus === 'error' && (
          <div className="triage-banner critical" style={{ marginTop: '24px', display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '14px 18px', borderRadius: '10px' }}>
            <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '13px' }}>
              <strong>Upload failed:</strong> {uploadError}
            </div>
          </div>
        )}
      </div>

      {/* Indexed Documents Table Panel */}
      <div className="clinical-card" style={{ padding: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--panel-border)', paddingBottom: '12px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-contrast)' }}>Uploaded sources</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>Your uploaded files used in case searches.</p>
          </div>
          <button 
            className="btn btn-secondary btn-icon-only" 
            onClick={fetchDocuments}
            disabled={isLoadingDocs}
            title="Refresh Database Index"
            style={{ width: '32px', height: '32px' }}
          >
            <RefreshCw size={14} className={isLoadingDocs ? 'spin-animation' : ''} />
          </button>
        </div>

        {isLoadingDocs ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '48px 0' }}>
            <RefreshCw size={26} className="spin-animation" style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Querying index namespace stats...</span>
          </div>
        ) : docError ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-rose)', fontSize: '13px', padding: '24px 0', justifyContent: 'center' }}>
            <AlertTriangle size={16} />
            Ingestion registry unreachable: {docError}
          </div>
        ) : documents.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '48px 0', border: '1px dashed var(--panel-border)', borderRadius: '10px' }}>
            <FileText size={36} style={{ color: 'var(--text-muted)' }} />
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600' }}>No uploads yet</div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Uploaded files will be available in future case searches.</div>
          </div>
        ) : (
          <div className="history-table-container" style={{ margin: 0, maxHeight: '350px', overflowY: 'auto' }}>
            <table className="history-table">
              <thead>
                <tr>
                  <th className="history-th" style={{ padding: '10px 16px', fontSize: '11px' }}>Citation Reference Title</th>
                  <th className="history-th" style={{ padding: '10px 16px', fontSize: '11px' }}>Ingested Filename</th>
                  <th className="history-th" style={{ padding: '10px 16px', fontSize: '11px', textAlign: 'center' }}>Vectors</th>
                  <th className="history-th" style={{ padding: '10px 16px', fontSize: '11px' }}>Ingestion Date</th>
                  <th className="history-th" style={{ padding: '10px 16px', fontSize: '11px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.document_id} className="history-tr">
                    <td className="history-td" style={{ padding: '12px 16px' }}>
                      <strong style={{ color: 'var(--text-contrast)' }}>{doc.title}</strong>
                    </td>
                    <td className="history-td" style={{ padding: '12px 16px', fontSize: '12px' }}>
                      {doc.filename}
                    </td>
                    <td className="history-td" style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span className="badge badge-outline" style={{ fontSize: '10.5px', padding: '2px 8px', fontFamily: 'var(--font-mono)' }}>
                        {doc.chunks} chunks
                      </span>
                    </td>
                    <td className="history-td" style={{ padding: '12px 16px', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
                      {formatDateTime(doc.uploaded_at)}
                    </td>
                    <td className="history-td" style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <button 
                        className="btn btn-secondary" 
                        onClick={() => handleDeleteDoc(doc.document_id)}
                        title="Delete Guideline Vectors"
                        style={{ padding: '6px 12px', fontSize: '12.5px', color: 'var(--accent-rose)', borderColor: 'rgba(244, 63, 94, 0.2)' }}
                      >
                        <Trash2 size={13} style={{ marginRight: '4px' }} />
                        Purge Index
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
