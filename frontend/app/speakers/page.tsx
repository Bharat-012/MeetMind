'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users,
  UserPlus,
  Search,
  Building,
  Clock,
  Video,
  ArrowLeft,
  Calendar,
  ChevronRight,
  Edit2,
  Trash2,
  X,
  Check,
  FileText,
  Activity,
  Sparkles
} from 'lucide-react';

export default function SpeakersDirectoryPage() {
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [speakers, setSpeakers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [editingSpeaker, setEditingSpeaker] = useState<any>(null);

  // Form fields
  const [formName, setFormName] = useState<string>('');
  const [formEmail, setFormEmail] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formError, setFormError] = useState<string>('');

  // Speaker history drawer state
  const [selectedSpeakerHistory, setSelectedSpeakerHistory] = useState<any>(null);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);

  useEffect(() => {
    fetch('http://localhost:8000/api/organizations')
      .then((res) => res.json())
      .then((orgs) => {
        if (orgs && orgs.length > 0) {
          setOrganizations(orgs);
          setSelectedOrgId(orgs[0].id);
        }
      })
      .catch((err) => console.error(err));
  }, []);

  useEffect(() => {
    if (!selectedOrgId) return;
    loadSpeakers();
  }, [selectedOrgId, searchQuery]);

  const loadSpeakers = async () => {
    setLoading(true);
    try {
      const qParam = searchQuery.trim() ? `?q=${encodeURIComponent(searchQuery.trim())}` : '';
      const res = await fetch(`http://localhost:8000/api/organizations/${selectedOrgId}/speakers${qParam}`);
      if (res.ok) {
        const data = await res.json();
        setSpeakers(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSpeaker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError('Name is required');
      return;
    }
    setFormError('');

    try {
      const res = await fetch(`http://localhost:8000/api/organizations/${selectedOrgId}/speakers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          email: formEmail.trim() || null,
          description: formDescription.trim() || null
        })
      });

      if (res.ok) {
        setIsCreateModalOpen(false);
        setFormName('');
        setFormEmail('');
        setFormDescription('');
        loadSpeakers();
      } else {
        const data = await res.json();
        setFormError(data.detail || 'Failed to create speaker');
      }
    } catch (err: any) {
      setFormError(err.message || 'Error creating profile');
    }
  };

  const handleEditSpeaker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !editingSpeaker) return;
    setFormError('');

    try {
      const res = await fetch(`http://localhost:8000/api/organizations/${selectedOrgId}/speakers/${editingSpeaker.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          email: formEmail.trim() || null,
          description: formDescription.trim() || null
        })
      });

      if (res.ok) {
        setIsEditModalOpen(false);
        setEditingSpeaker(null);
        setFormName('');
        setFormEmail('');
        setFormDescription('');
        loadSpeakers();
      } else {
        const data = await res.json();
        setFormError(data.detail || 'Failed to update speaker');
      }
    } catch (err: any) {
      setFormError(err.message || 'Error updating profile');
    }
  };

  const handleDeleteSpeaker = async (speakerId: string, name: string) => {
    if (!confirm(`Are you sure you want to remove speaker profile '${name}'? This will unlink them from previous meetings but retain the meeting recordings and original speaker IDs.`)) {
      return;
    }

    try {
      const res = await fetch(`http://localhost:8000/api/organizations/${selectedOrgId}/speakers/${speakerId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        loadSpeakers();
        if (selectedSpeakerHistory?.participant?.id === speakerId) {
          setSelectedSpeakerHistory(null);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleViewHistory = async (speaker: any) => {
    setHistoryLoading(true);
    setSelectedSpeakerHistory({ participant: speaker, appearances: [], recent_segments: [] });
    try {
      const res = await fetch(`http://localhost:8000/api/organizations/${selectedOrgId}/speakers/${speaker.id}/history`);
      if (res.ok) {
        const data = await res.json();
        setSelectedSpeakerHistory(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const openEditModal = (speaker: any) => {
    setEditingSpeaker(speaker);
    setFormName(speaker.name);
    setFormEmail(speaker.email || '');
    setFormDescription(speaker.description || '');
    setFormError('');
    setIsEditModalOpen(true);
  };

  const formatSeconds = (sec: number) => {
    if (!sec || sec <= 0) return '0m';
    const mins = Math.floor(sec / 60);
    const hours = Math.floor(mins / 60);
    if (hours > 0) {
      return `${hours}h ${mins % 60}m`;
    }
    return `${mins}m ${Math.floor(sec % 60)}s`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navigation */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur sticky top-0 z-20 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/workspace"
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition px-2.5 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900/50"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Workspace</span>
          </Link>
          <div className="h-4 w-[1px] bg-slate-800" />
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-wide text-white">Speaker Directory</h1>
              <p className="text-[11px] text-slate-400">Organization-level participant profiles and meeting attribution</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Org Selector */}
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5">
            <Building className="h-3.5 w-3.5 text-indigo-400" />
            <select
              value={selectedOrgId}
              onChange={(e) => setSelectedOrgId(e.target.value)}
              className="bg-transparent text-xs text-slate-200 outline-none cursor-pointer pr-2 font-medium"
            >
              {organizations.map((org) => (
                <option key={org.id} value={org.id} className="bg-slate-900 text-slate-200">
                  {org.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => {
              setFormName('');
              setFormEmail('');
              setFormDescription('');
              setFormError('');
              setIsCreateModalOpen(true);
            }}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-3.5 py-2 rounded-lg transition shadow-md shadow-indigo-600/20"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>Add Speaker Profile</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto p-6 gap-6 overflow-hidden">
        {/* Left Column: Speaker List */}
        <div className="flex-1 flex flex-col space-y-4 min-w-0">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search speaker profiles by name, role, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          {/* Speaker Cards Grid */}
          {loading ? (
            <div className="flex-1 flex items-center justify-center p-12 text-slate-500 text-xs">
              Loading speaker directory...
            </div>
          ) : speakers.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 border border-dashed border-slate-800 rounded-2xl text-center">
              <Users className="h-8 w-8 text-slate-600 mb-3" />
              <h3 className="text-sm font-semibold text-slate-300">No speaker profiles found</h3>
              <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4">
                {searchQuery ? 'No profiles matched your search.' : 'Create reusable profiles to link diarized speakers across your organization meetings.'}
              </p>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3.5 py-2 rounded-lg font-medium transition"
              >
                Create First Profile
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto pr-1">
              {speakers.map((spk) => {
                const isSelected = selectedSpeakerHistory?.participant?.id === spk.id;
                return (
                  <div
                    key={spk.id}
                    className={`p-4 rounded-xl border transition flex flex-col justify-between ${
                      isSelected
                        ? 'bg-indigo-950/30 border-indigo-500/50 shadow-md shadow-indigo-950/40'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-indigo-900/50 border border-indigo-700/50 flex items-center justify-center text-indigo-300 font-bold text-sm">
                            {spk.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h3 className="font-semibold text-sm text-white">{spk.name}</h3>
                            {spk.email && <p className="text-xs text-slate-400 font-mono">{spk.email}</p>}
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEditModal(spk)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                            title="Edit Profile"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteSpeaker(spk.id, spk.name)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition"
                            title="Delete Profile"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {spk.description && (
                        <p className="text-xs text-slate-300 mt-2.5 leading-relaxed line-clamp-2">
                          {spk.description}
                        </p>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3 text-slate-400">
                        <span className="flex items-center gap-1">
                          <Video className="h-3.5 w-3.5 text-slate-500" />
                          <span>{spk.total_meetings} {spk.total_meetings === 1 ? 'meeting' : 'meetings'}</span>
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-slate-500" />
                          <span>{formatSeconds(spk.total_talk_time_seconds)}</span>
                        </span>
                      </div>

                      <button
                        onClick={() => handleViewHistory(spk)}
                        className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition"
                      >
                        <span>History</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Speaker Detail & History Drawer */}
        <div className="w-96 flex flex-col bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
          {selectedSpeakerHistory ? (
            <div className="flex flex-col h-full">
              {/* Drawer Header */}
              <div className="p-4 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-full bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-300 font-bold text-xs">
                    {selectedSpeakerHistory.participant.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-xs text-white">{selectedSpeakerHistory.participant.name}</h3>
                    <p className="text-[10px] text-slate-400">Participation History</p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedSpeakerHistory(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-5">
                {/* Stats Summary */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-center">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Meetings Attended</span>
                    <p className="text-lg font-bold text-white mt-0.5">{selectedSpeakerHistory.participant.total_meetings}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-center">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Speaking Time</span>
                    <p className="text-lg font-bold text-indigo-400 mt-0.5">
                      {formatSeconds(selectedSpeakerHistory.participant.total_talk_time_seconds)}
                    </p>
                  </div>
                </div>

                {/* Meetings List */}
                <div className="space-y-2.5">
                  <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-indigo-400" />
                    <span>Meeting Appearances</span>
                  </h4>
                  {selectedSpeakerHistory.appearances.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">No meeting appearances recorded yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedSpeakerHistory.appearances.map((app: any) => (
                        <Link
                          key={app.meeting_id}
                          href={`/meetings/${app.meeting_id}`}
                          className="block p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500/50 transition group"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-slate-200 group-hover:text-white truncate">
                              {app.meeting_title}
                            </span>
                            <span className="text-[10px] font-mono text-indigo-300 bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-800/50">
                              {app.speaker_label}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span>{app.segment_count} segments</span>
                            <span className="font-mono text-slate-400">{formatSeconds(app.talk_time_seconds)}</span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recent Segments */}
                <div className="space-y-2.5">
                  <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-indigo-400" />
                    <span>Recent Spoken Segments</span>
                  </h4>
                  {selectedSpeakerHistory.recent_segments.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">No transcript segments recorded.</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedSpeakerHistory.recent_segments.slice(0, 10).map((seg: any) => (
                        <div key={seg.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800/60 text-xs">
                          <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                            <span className="font-mono text-indigo-400">
                              [{Math.floor(seg.start_time / 60)}:{(Math.floor(seg.start_time % 60)).toString().padStart(2, '0')}]
                            </span>
                            <span className="text-slate-400">{seg.speaker_label}</span>
                          </div>
                          <p className="text-slate-300 leading-relaxed text-[11px]">{seg.text}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
              <Activity className="h-8 w-8 text-slate-700 mb-2" />
              <p className="text-xs font-medium text-slate-400">Select a speaker to view participation history</p>
              <p className="text-[11px] text-slate-600 mt-1 max-w-xs">
                View meeting appearances, total talk time, and recent quotes attributed to this speaker across all organization meetings.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* CREATE MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-indigo-400" />
                <span>Create Speaker Profile</span>
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSpeaker} className="space-y-4">
              {formError && (
                <div className="p-2.5 rounded-lg bg-red-950/50 border border-red-800/50 text-red-300 text-xs">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Display Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Jane Doe, Dr. Alice Johnson"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email (Optional)</label>
                <input
                  type="email"
                  placeholder="jane.doe@company.com"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Role / Description (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Lead Designer, Client Representative"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-md shadow-indigo-600/30"
                >
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Edit2 className="h-4 w-4 text-indigo-400" />
                <span>Edit Speaker Profile</span>
              </h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleEditSpeaker} className="space-y-4">
              {formError && (
                <div className="p-2.5 rounded-lg bg-red-950/50 border border-red-800/50 text-red-300 text-xs">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Display Name *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email</label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Role / Description</label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-md shadow-indigo-600/30"
                >
                  Update Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

