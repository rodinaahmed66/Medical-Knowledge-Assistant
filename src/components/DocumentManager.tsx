import React, { useState } from 'react';
import { Upload, FileText, Trash2, CheckCircle2, AlertCircle, Layers, Eye, RefreshCw, FileCheck, BookOpen, Download } from 'lucide-react';
import { DocumentRecord, ChunkRecord } from '../types';

interface DocumentManagerProps {
  documents: DocumentRecord[];
  onRefresh: () => void;
}

export const DocumentManager: React.FC<DocumentManagerProps> = ({ documents, onRefresh }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ success: boolean; msg: string } | null>(null);
  const [inspectDocId, setInspectDocId] = useState<string | null>(null);
  const [docChunks, setDocChunks] = useState<ChunkRecord[]>([]);
  const [loadingChunks, setLoadingChunks] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setUploadStatus(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setUploadStatus(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await fetch('/api/upload/file', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      if (res.ok) {
        setUploadStatus({
          success: true,
          msg: `Successfully uploaded and generated ${data.chunksCreated || 0} chunks.`
        });
        setSelectedFile(null);
        onRefresh();
      } else {
        setUploadStatus({
          success: false,
          msg: data.error || data.signal || 'Upload failed'
        });
      }
    } catch (err: any) {
      setUploadStatus({
        success: false,
        msg: `Upload error: ${err.message}`
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this document from the reference library?')) return;
    try {
      await fetch(`/api/documents/${id}`, { method: 'DELETE' });
      if (inspectDocId === id) {
        setInspectDocId(null);
        setDocChunks([]);
      }
      onRefresh();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleInspectChunks = async (docId: string) => {
    if (inspectDocId === docId) {
      setInspectDocId(null);
      setDocChunks([]);
      return;
    }
    setInspectDocId(docId);
    setLoadingChunks(true);
    try {
      const res = await fetch(`/api/documents/${docId}/chunks`);
      const data = await res.json();
      setDocChunks(data.chunks || []);
    } catch (err) {
      console.error('Chunks fetch error:', err);
    } finally {
      setLoadingChunks(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-600" />
            Clinical Reference Library & Indexed Guidelines
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Indexed guidelines and textbooks for semantic similarity and hybrid vector retrieval.
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-medium transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Sync Library</span>
        </button>
      </div>

      {/* Upload Box */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <Upload className="w-4 h-4 text-blue-600" />
          Ingest Medical Document or Clinical Guideline
        </h3>

        <div className="border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-xl p-6 text-center transition-colors bg-slate-50/50">
          <input
            id="file-upload-input"
            type="file"
            accept=".pdf,.txt,.md"
            onChange={handleFileChange}
            className="hidden"
          />
          <label
            htmlFor="file-upload-input"
            className="cursor-pointer flex flex-col items-center justify-center space-y-2"
          >
            <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <FileCheck className="w-6 h-6" />
            </div>
            <div className="text-sm text-slate-800 font-medium">
              {selectedFile ? selectedFile.name : 'Choose a guideline file to index (PDF, TXT, MD)'}
            </div>
            <p className="text-xs text-slate-500">
              Documents are processed with semantic chunking and stored in the vector database.
            </p>
          </label>

          {selectedFile && (
            <div className="mt-4 flex items-center justify-center gap-3">
              <span className="text-xs text-slate-700 bg-slate-200 px-3 py-1 rounded-full font-medium">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </span>
              <button
                id="btn-confirm-upload"
                onClick={handleUpload}
                disabled={isUploading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-xs font-semibold px-4 py-2 rounded-lg flex items-center gap-2 transition-all shadow-xs"
              >
                {isUploading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Indexing Chunks...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    <span>Index into Reference Library</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {uploadStatus && (
          <div className={`mt-3 p-3 rounded-lg flex items-center gap-2 text-xs font-medium ${
            uploadStatus.success
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}>
            {uploadStatus.success ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
            <span>{uploadStatus.msg}</span>
          </div>
        )}
      </div>

      {/* Documents Table */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600" />
            Verified Medical Documents ({documents.length})
          </h3>
        </div>

        {documents.length === 0 ? (
          <div className="py-12 px-4 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <FileText className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-semibold text-slate-800">No documents indexed yet</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              Upload clinical guidelines, research papers, or medical textbooks above to start building your vector knowledge base.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 font-semibold">Document Title</th>
                  <th className="py-3 px-4 font-semibold">Format & Size</th>
                  <th className="py-3 px-4 font-semibold">Indexed Chunks</th>
                  <th className="py-3 px-4 font-semibold">Verification</th>
                  <th className="py-3 px-4 font-semibold">Date Added</th>
                  <th className="py-3 px-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {documents.map((doc) => (
                  <React.Fragment key={doc.id}>
                    <tr className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-medium text-slate-900">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 border border-blue-100">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-semibold text-slate-800">{doc.filename}</div>
                            {doc.snippet && (
                              <p className="text-[11px] text-slate-500 line-clamp-1 max-w-md font-normal">
                                {doc.snippet}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        <span className="uppercase text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono mr-1">
                          {doc.fileType.split('/')[1] || doc.fileType}
                        </span>
                        {(doc.fileSize / 1024).toFixed(0)} KB
                      </td>
                      <td className="py-3.5 px-4 font-mono font-medium text-blue-600">
                        {doc.chunksCount} chunks
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Indexed
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">
                        {new Date(doc.uploadedAt).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-1.5">
                        <button
                          onClick={() => handleInspectChunks(doc.id)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors font-medium text-xs inline-flex items-center gap-1"
                          title="Inspect Chunks"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Chunks</span>
                        </button>
                        <button
                          onClick={() => handleDelete(doc.id)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                          title="Delete Document"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>

                    {/* Chunks preview drawer */}
                    {inspectDocId === doc.id && (
                      <tr>
                        <td colSpan={6} className="p-4 bg-slate-50/80 border-t border-b border-blue-100">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between text-xs font-semibold text-blue-700">
                              <span>Indexed Chunks for {doc.filename} ({docChunks.length} chunks):</span>
                              <button
                                onClick={() => setInspectDocId(null)}
                                className="text-slate-400 hover:text-slate-700"
                              >
                                Close
                              </button>
                            </div>

                            {loadingChunks ? (
                              <div className="text-xs text-slate-500 py-2">Loading chunks...</div>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
                                {docChunks.map((chk, i) => (
                                  <div key={i} className="p-3 bg-white rounded-lg border border-slate-200 text-xs shadow-2xs">
                                    <div className="flex justify-between text-[10px] text-blue-600 font-mono mb-1 font-semibold">
                                      <span>Chunk #{chk.chunkIndex + 1}</span>
                                      <span className="text-slate-400">ID: {chk.id}</span>
                                    </div>
                                    <p className="text-slate-700 leading-relaxed font-sans">{chk.pageContent || (chk as any).content}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};
