'use client';

import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  Link as LinkIcon,
  X,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  FileVideo,
  FileAudio,
  Tv,
  Info
} from 'lucide-react';

interface IngestModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: string;
  workspaceId: string;
  onSuccess: (meeting: any) => void;
}

export default function IngestModal({
  isOpen,
  onClose,
  organizationId,
  workspaceId,
  onSuccess,
}: IngestModalProps) {
  const [activeTab, setActiveTab] = useState<'upload' | 'url'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
      setError(null);
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please select an audio or video file to upload.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('organization_id', organizationId);
    formData.append('workspace_id', workspaceId || organizationId);
    if (title.trim()) formData.append('title', title.trim());
    if (description.trim()) formData.append('description', description.trim());

    try {
      const res = await fetch('http://localhost:8000/api/meetings/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Upload failed with HTTP ${res.status}`);
      }

      const data = await res.json();
      onSuccess(data);
      onClose();
    } catch (err: any) {
      setError(err.message || 'An error occurred during media upload.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUrlImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      setError('Please provide a valid YouTube URL (e.g. https://www.youtube.com/watch?v=...).');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('http://localhost:8000/api/meetings/import-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: organizationId,
          workspace_id: workspaceId || organizationId,
          url: url.trim(),
          title: title.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `URL import failed with HTTP ${res.status}`);
      }

      const data = await res.json();
      onSuccess(data);
      onClose();
    } catch (err: any) {
      setError(err.message || 'An error occurred during URL import.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#0e1526] border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col text-slate-100">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div>
            <h3 className="font-semibold text-sm text-white">Ingest New Meeting</h3>
            <p className="text-xs text-slate-400">Process media with local Faster-Whisper and Nemotron-3</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Source Segmented Tabs */}
        <div className="px-6 pt-4 pb-2 border-b border-slate-800/80 bg-slate-950/40">
          <div className="grid grid-cols-2 p-1 bg-slate-900 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setActiveTab('upload');
                setError(null);
              }}
              className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition ${
                activeTab === 'upload'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <UploadCloud className="h-3.5 w-3.5" />
              <span>Upload Local File</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('url');
                setError(null);
              }}
              className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition ${
                activeTab === 'url'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Tv className="h-3.5 w-3.5" />
              <span>Import YouTube</span>
            </button>
          </div>
        </div>

        {/* Error Callout */}
        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-950/40 border border-rose-800/40 text-rose-300 text-xs flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold block">Ingestion Error</span>
              <span className="text-[11px] text-rose-200/90 leading-tight">{error}</span>
            </div>
          </div>
        )}

        {/* Tab 1: Local File Upload */}
        {activeTab === 'upload' && (
          <form onSubmit={handleFileUpload} className="p-6 space-y-4">
            {/* Dropzone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition ${
                isDragging
                  ? 'border-indigo-500 bg-indigo-500/10'
                  : file
                  ? 'border-indigo-500/60 bg-indigo-950/20'
                  : 'border-slate-800 hover:border-slate-700 bg-slate-950/40 hover:bg-slate-900/40'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,video/*,.mp4,.mov,.mkv,.webm,.wav,.mp3,.m4a,.aac"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    setFile(e.target.files[0]);
                    setError(null);
                  }
                }}
                className="hidden"
              />

              {file ? (
                <div className="space-y-1">
                  <div className="h-10 w-10 mx-auto rounded-full bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
                    {file.type.startsWith('video') ? (
                      <FileVideo className="h-5 w-5" />
                    ) : (
                      <FileAudio className="h-5 w-5" />
                    )}
                  </div>
                  <p className="text-xs font-semibold text-white truncate max-w-xs mx-auto">
                    {file.name}
                  </p>
                  <p className="text-[11px] text-slate-400 font-mono">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                  <span className="inline-block mt-1 text-[10px] text-indigo-400 font-medium hover:underline">
                    Click to change file
                  </span>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="h-10 w-10 mx-auto rounded-full bg-slate-800/80 text-slate-400 flex items-center justify-center">
                    <UploadCloud className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-white">
                      Drop audio or video file here, or <span className="text-indigo-400">browse</span>
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Supported: MP4, MOV, MKV, WebM, WAV, MP3, M4A, AAC (up to 500MB)
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Optional Metadata */}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Meeting Title <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={file ? file.name.replace(/\.[^/.]+$/, '') : 'e.g. Sprint Architecture Sync'}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Description <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Q4 database migration & microservices roadmap"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800/80">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-3.5 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !file}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <span>Start Processing</span>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: YouTube Import */}
        {activeTab === 'url' && (
          <form onSubmit={handleUrlImport} className="p-6 space-y-4">
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-start gap-2.5">
              <Info className="h-4 w-4 text-indigo-400 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Provide a public YouTube video URL. MeetMind downloads the stream locally, extracts high-fidelity audio, and executes local speech recognition and Nemotron-3 diarization.
              </p>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                YouTube Video URL <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="url"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setError(null);
                  }}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 font-mono"
                  required
                />
                <Tv className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                Custom Title <span className="text-slate-400 font-normal">(optional — defaults to YouTube video title)</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Tech Talk: Building Scalable Systems"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800/80">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-3.5 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !url.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Importing...</span>
                  </>
                ) : (
                  <span>Import & Process</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
