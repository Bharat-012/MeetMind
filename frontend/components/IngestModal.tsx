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
  Sparkles
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#252238]/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white border border-[#E9E4F2] rounded-3xl w-full max-w-lg shadow-soft-elevated overflow-hidden flex flex-col text-[#252238]">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-[#E9E4F2] flex items-center justify-between bg-gradient-to-r from-white via-[#FAF8FF] to-white">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-[#F3ECFE] text-[#8B45D6] flex items-center justify-center shadow-sm">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-[#252238]">Import Meeting</h3>
              <p className="text-xs text-[#77738A]">Process media with local Faster-Whisper and Nemotron-3</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#77738A] hover:text-[#252238] p-2 rounded-xl hover:bg-[#F3F0FF] transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Source Segmented Tabs */}
        <div className="px-6 pt-4 pb-2 border-b border-[#E9E4F2] bg-[#FAF8FF]">
          <div className="grid grid-cols-2 p-1 bg-[#F3F0FF] rounded-2xl border border-[#E9E4F2]">
            <button
              type="button"
              onClick={() => {
                setActiveTab('upload');
                setError(null);
              }}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition ${
                activeTab === 'upload'
                  ? 'gradient-purple-hero text-white shadow-purple-btn'
                  : 'text-[#77738A] hover:text-[#252238]'
              }`}
            >
              <UploadCloud className="h-4 w-4" />
              <span>Upload Local File</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('url');
                setError(null);
              }}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition ${
                activeTab === 'url'
                  ? 'gradient-purple-hero text-white shadow-purple-btn'
                  : 'text-[#77738A] hover:text-[#252238]'
              }`}
            >
              <Tv className="h-4 w-4" />
              <span>Import YouTube</span>
            </button>
          </div>
        </div>

        {/* Error Callout */}
        {error && (
          <div className="mx-6 mt-4 p-3.5 rounded-2xl bg-[#FDF0F4] border border-[#FBCFE8] text-[#BE123C] text-xs flex items-start gap-2.5 shadow-sm">
            <AlertTriangle className="h-4 w-4 text-[#BE123C] flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold block text-[#9F1239]">Ingestion Error</span>
              <span className="text-[11px] text-[#BE123C] leading-tight">{error}</span>
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
              className={`border-2 border-dashed rounded-3xl p-7 text-center cursor-pointer transition ${
                isDragging
                  ? 'border-[#8B45D6] bg-[#F3ECFE]/50'
                  : file
                  ? 'border-[#8B45D6]/80 bg-[#FAF8FF]'
                  : 'border-[#DDD5FF] hover:border-[#8B45D6] bg-[#FAF8FF] hover:bg-[#F3ECFE]/30'
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
                <div className="space-y-2">
                  <div className="h-12 w-12 mx-auto rounded-2xl bg-[#F3ECFE] text-[#8B45D6] flex items-center justify-center shadow-sm">
                    {file.type.startsWith('video') ? (
                      <FileVideo className="h-6 w-6" />
                    ) : (
                      <FileAudio className="h-6 w-6" />
                    )}
                  </div>
                  <p className="text-sm font-bold text-[#252238] truncate max-w-xs mx-auto">
                    {file.name}
                  </p>
                  <p className="text-xs text-[#77738A] font-mono">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                  <span className="inline-block mt-1 text-xs text-[#8B45D6] font-semibold hover:underline">
                    Click to choose a different file
                  </span>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="h-12 w-12 mx-auto rounded-2xl bg-[#F3ECFE] text-[#8B45D6] flex items-center justify-center shadow-sm">
                    <UploadCloud className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#252238]">
                      Drop audio or video file here, or <span className="text-[#8B45D6] underline font-bold">browse</span>
                    </p>
                    <p className="text-xs text-[#77738A] mt-1">
                      Supported: MP4, MOV, MKV, WebM, WAV, MP3, M4A, AAC (up to 500MB)
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Optional Metadata */}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-[#252238] block mb-1">
                  Meeting Title <span className="text-[#9D99AF] font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={file ? file.name.replace(/\.[^/.]+$/, '') : 'e.g. Sprint Architecture Sync'}
                  className="w-full px-4 py-2.5 bg-[#FAF8FF] border border-[#E9E4F2] rounded-2xl text-xs text-[#252238] placeholder-[#9D99AF] focus:outline-none focus:border-[#8B45D6] focus:bg-white transition"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#252238] block mb-1">
                  Description <span className="text-[#9D99AF] font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Q4 database migration & microservices roadmap"
                  className="w-full px-4 py-2.5 bg-[#FAF8FF] border border-[#E9E4F2] rounded-2xl text-xs text-[#252238] placeholder-[#9D99AF] focus:outline-none focus:border-[#8B45D6] focus:bg-white transition"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-[#E9E4F2]">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-semibold text-[#77738A] hover:text-[#252238] rounded-xl hover:bg-[#F3F0FF] transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !file}
                className="px-5 py-2.5 gradient-purple-hero text-white rounded-2xl text-xs font-semibold shadow-purple-btn disabled:opacity-50 transition flex items-center gap-2"
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
            <div>
              <label className="text-xs font-semibold text-[#252238] block mb-1">
                YouTube Video URL <span className="text-[#BE123C]">*</span>
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
                  className="w-full pl-10 pr-4 py-2.5 bg-[#FAF8FF] border border-[#E9E4F2] rounded-2xl text-xs text-[#252238] placeholder-[#9D99AF] focus:outline-none focus:border-[#8B45D6] focus:bg-white font-mono transition"
                  required
                />
                <Tv className="absolute left-3.5 top-3 h-4 w-4 text-[#8B45D6]" />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#252238] block mb-1">
                Custom Title <span className="text-[#9D99AF] font-normal">(optional — defaults to YouTube video title)</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Tech Talk: Building Scalable Systems"
                className="w-full px-4 py-2.5 bg-[#FAF8FF] border border-[#E9E4F2] rounded-2xl text-xs text-[#252238] placeholder-[#9D99AF] focus:outline-none focus:border-[#8B45D6] focus:bg-white transition"
              />
            </div>

            {/* Actions */}
            <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-[#E9E4F2]">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-semibold text-[#77738A] hover:text-[#252238] rounded-xl hover:bg-[#F3F0FF] transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !url.trim()}
                className="px-5 py-2.5 gradient-purple-hero text-white rounded-2xl text-xs font-semibold shadow-purple-btn disabled:opacity-50 transition flex items-center gap-2"
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
