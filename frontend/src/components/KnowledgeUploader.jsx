import React, { useState, useEffect } from 'react';
import { 
  UploadCloud, 
  FileText, 
  Database, 
  Trash2, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  Plus, 
  Info,
  Calendar,
  Layers,
  Sparkles
} from 'lucide-react';

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

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    setIsLoadingDocs(true);
    setDocError(null);
    try {
      const response = await fetch('http://localhost:8000/knowledge/documents');
      if (!response.ok) {
        throw new Error('Failed to retrieve indexed documents list.');
      }
      const data = await response.json();
      setDocuments(data);
    } catch (err) {
      setDocError(err.message);
    } finally {
      setIsLoadingDocs(false);
    }
  };

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
        } catch (err) {
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
      uploadUrl = 'http://localhost:8000/knowledge/upload/guidelines';
    } else if (detectedRoute === 'structured') {
      formData.append('file', file);
      uploadUrl = 'http://localhost:8000/knowledge/upload/structured';
    }

    const xhr = new XMLHttpRequest();
    xhr.open('POST', uploadUrl, true);

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
      const response = await fetch(`http://localhost:8000/knowledge/documents/${docId}`, {
        method: 'DELETE'
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
      <div className="clinical-card" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-contrast)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <Sparkles size={15} style={{ color: 'var(--accent-cyan)' }} />
          Knowledge Ingestion Engine
        </h3>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
          Upload medical research guidelines to seed the Vector RAG DB, or upload drug-drug interaction CSV datasets to extend the Neo4j Knowledge Graph.
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
          >
            <input 
              id="file-input-element" 
              type="file" 
              style={{ display: 'none' }} 
              accept=".pdf,.txt,.csv"
              onChange={(e) => handleFileChange(e.target.files[0])}
            />

            {!file ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                <div className="drop-icon-wrapper">
                  <UploadCloud size={24} style={{ color: 'var(--accent-cyan)' }} />
                </div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-contrast)' }}>
                  Drag & drop medical files or <span style={{ color: 'var(--accent-cyan)', textDecoration: 'underline', cursor: 'pointer' }}>browse files</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Accepts PDF or TXT (for RAG Vector DB) and CSV (for Neo4j Interactions Graph)
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', width: '100%', justifyContent: 'center' }}>
                <div className="drop-icon-wrapper" style={{ background: detectedRoute === 'guideline' ? 'rgba(139, 92, 246, 0.1)' : 'rgba(16, 185, 129, 0.1)' }}>
                  {detectedRoute === 'guideline' ? (
                    <FileText size={22} style={{ color: 'var(--accent-purple)' }} />
                  ) : (
                    <Database size={22} style={{ color: 'var(--accent-emerald)' }} />
                  )}
                </div>
                <div style={{ textAlign: 'left', flex: 1, maxWidth: '400px' }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-contrast)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {file.name}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Size: {(file.size / 1024).toFixed(1)} KB | Target: {' '}
                    {detectedRoute === 'guideline' ? (
                      <span style={{ color: 'var(--accent-purple)', fontWeight: '600' }}>Pinecone user_uploads (Vector RAG)</span>
                    ) : (
                      <span style={{ color: 'var(--accent-emerald)', fontWeight: '600' }}>Neo4j (Knowledge Graph)</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Form details / options when file is loaded */}
          {file && detectedRoute && (
            <div style={{ marginTop: '20px', borderTop: '1px solid var(--panel-border)', paddingTop: '16px' }}>
              {detectedRoute === 'guideline' && (
                <div style={{ marginBottom: '16px' }}>
                  <label className="form-label" style={{ display: 'block', marginBottom: '6px' }}>Document Title (For search citations reference)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Enter custom title or leave default..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>
              )}

              {validationWarning && (
                <div className="triage-banner" style={{ background: 'rgba(245, 158, 11, 0.06)', borderColor: 'rgba(245, 158, 11, 0.2)', color: 'var(--accent-amber)', fontSize: '11px', marginBottom: '16px', display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '10px 14px', borderRadius: '6px' }}>
                  <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
                  <div>
                    <strong style={{ display: 'block', marginBottom: '2px' }}>File Validation Warning</strong>
                    {validationWarning}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => { setFile(null); setDetectedRoute(null); setValidationWarning(null); }}
                  style={{ padding: '8px 16px', fontSize: '12px' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  style={{ padding: '8px 16px', fontSize: '12px' }}
                  disabled={uploadStatus === 'uploading' || uploadStatus === 'processing'}
                >
                  Confirm Upload & Process
                </button>
              </div>
            </div>
          )}
        </form>

        {/* Upload Progress Bar / Status Alerts */}
        {(uploadStatus === 'uploading' || uploadStatus === 'processing') && (
          <div style={{ marginTop: '20px', padding: '16px', background: 'rgba(14, 165, 233, 0.04)', border: '1px solid rgba(14, 165, 233, 0.1)', borderRadius: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
              <span style={{ color: 'var(--text-contrast)', fontWeight: '600' }}>
                {uploadStatus === 'uploading' ? "Uploading to clinical server..." : "Processing & Indexing embeddings..."}
              </span>
              <span style={{ color: 'var(--accent-cyan)' }}>{uploadProgress}%</span>
            </div>
            <div className="confidence-slider-bg" style={{ height: '6px' }}>
              <div 
                className="confidence-slider-fill" 
                style={{ width: `${uploadProgress}%`, height: '6px', backgroundColor: 'var(--accent-cyan)' }}
              ></div>
            </div>
          </div>
        )}

        {uploadStatus === 'success' && (
          <div className="triage-banner" style={{ background: 'rgba(16, 185, 129, 0.06)', borderColor: 'rgba(16, 185, 129, 0.2)', color: 'var(--accent-emerald)', marginTop: '20px', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '6px' }}>
            <CheckCircle2 size={16} />
            <div style={{ fontSize: '12px' }}>
              <strong>Upload Successful:</strong> Document parsed and integrated into databases.
            </div>
          </div>
        )}

        {uploadStatus === 'error' && (
          <div className="triage-banner critical" style={{ marginTop: '20px', display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 14px', borderRadius: '6px' }}>
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '12px' }}>
              <strong>Ingestion Failed:</strong> {uploadError}
            </div>
          </div>
        )}
      </div>

      {/* Indexed Documents Table Panel (Only Pinecone user guidelines) */}
      <div className="clinical-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--panel-border)', paddingBottom: '10px' }}>
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-contrast)' }}>Custom Grounding Guidelines</h3>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Guidelines vectors active in Pinecone namespace 'user_uploads'</p>
          </div>
          <button 
            className="btn btn-secondary btn-icon-only" 
            onClick={fetchDocuments}
            disabled={isLoadingDocs}
            title="Refresh Guidelines List"
            style={{ width: '28px', height: '28px' }}
          >
            <RefreshCw size={12} className={isLoadingDocs ? 'spin-animation' : ''} />
          </button>
        </div>

        {isLoadingDocs ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '40px 0' }}>
            <RefreshCw size={24} className="spin-animation" style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Retrieving indexes stats...</span>
          </div>
        ) : docError ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-rose)', fontSize: '12px', padding: '20px 0', justifyContent: 'center' }}>
            <AlertTriangle size={14} />
            Failed to retrieve indexed custom guidelines: {docError}
          </div>
        ) : documents.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '40px 0', border: '1px dashed var(--panel-border)', borderRadius: '6px' }}>
            <FileText size={32} style={{ color: 'var(--text-muted)' }} />
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '500' }}>No custom guidelines indexed yet</div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Ingested documents will appear in grounding searches immediately.</div>
          </div>
        ) : (
          <div className="history-table-container" style={{ margin: 0, maxHeight: '300px', overflowY: 'auto' }}>
            <table className="history-table" style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  <th className="history-th" style={{ padding: '8px 12px', fontSize: '11px' }}>Title</th>
                  <th className="history-th" style={{ padding: '8px 12px', fontSize: '11px' }}>Filename</th>
                  <th className="history-th" style={{ padding: '8px 12px', fontSize: '11px', textAlign: 'center' }}>Chunks</th>
                  <th className="history-th" style={{ padding: '8px 12px', fontSize: '11px' }}>Uploaded At</th>
                  <th className="history-th" style={{ padding: '8px 12px', fontSize: '11px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.document_id} className="history-tr">
                    <td className="history-td" style={{ padding: '8px 12px', fontSize: '12px' }}>
                      <strong>{doc.title}</strong>
                    </td>
                    <td className="history-td" style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                      {doc.filename}
                    </td>
                    <td className="history-td" style={{ padding: '8px 12px', fontSize: '11px', textAlign: 'center' }}>
                      <span className="badge badge-outline" style={{ fontSize: '10px', padding: '1px 5px' }}>
                        {doc.chunks} chunks
                      </span>
                    </td>
                    <td className="history-td" style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--text-muted)' }}>
                      {formatDateTime(doc.uploaded_at)}
                    </td>
                    <td className="history-td" style={{ padding: '8px 12px', textAlign: 'right' }}>
                      <button 
                        className="btn btn-secondary" 
                        onClick={() => handleDeleteDoc(doc.document_id)}
                        title="Delete Guideline Vectors"
                        style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--accent-rose)', borderColor: 'rgba(244, 63, 94, 0.15)' }}
                      >
                        <Trash2 size={12} style={{ marginRight: '4px' }} />
                        Delete
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
