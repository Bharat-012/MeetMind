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
  ChevronRight,
  Edit2,
  Trash2,
  X,
  Check,
  FileText,
  Activity,
  Calendar,
  Sparkles,
  AlertTriangle,
  Loader2,
  User
} from 'lucide-react';
import AppShell from '@/components/AppShell';

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
  const [formSubmitting, setFormSubmitting] = useState<boolean>(false);

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
      setFormError('Speaker name is required');
      return;
    }
    setFormError('');
    setFormSubmitting(true);

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
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleEditSpeaker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !editingSpeaker) return;
    setFormError('');
    setFormSubmitting(true);

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
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeleteSpeaker = async (speakerId: string, name: string) => {
    if (!confirm(`Are you sure you want to remove speaker profile '${name}'? This will unlink them from previous meetings but retain meeting recordings and raw speaker IDs.`)) {
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
    <AppShell
      title="Speaker Directory"
      subtitle="Organization participants, confirmed profiles, and historical attribution"
      activeOrgId={selectedOrgId}
      onOrgChange={setSelectedOrgId}
      organizations={organizations}
      actionButton={
        <button
          onClick={() => {
            setFormName('');
            setFormEmail('');
            setFormDescription('');
            setFormError('');
            setIsCreateModalOpen(true);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-sm transition"
        >
          <UserPlus className="h-3.5 w-3.5" />
          <span>New Speaker</span>
        </button>
      }
    >
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
        {/* Search & Actions Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search speakers by name, email, or role..."
              className="w-full pl-9 pr-3 py-2 bg-[#0f172a] border border-slate-800 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
            <span>{speakers.length} confirmed profiles</span>
          </div>
        </div>

        {/* Main Content Layout with Side-by-Side Drawer */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Left Column: Speaker Cards Grid */}
          <div className="flex-1 w-full">
            {loading ? (
              <div className="p-12 text-center rounded-xl border border-slate-800 bg-[#0f172a] text-xs text-slate-400">
                Loading speakers...
              </div>
            ) : speakers.length === 0 ? (
              <div className="p-12 text-center rounded-xl border border-dashed border-slate-800 bg-[#0f172a]/40 space-y-3">
                <Users className="h-8 w-8 text-slate-400 mx-auto" />
                <p className="text-sm font-semibold text-white">No speakers found</p>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  {searchQuery
                    ? 'No speakers matched your query.'
                    : 'Create your first speaker profile to attribute transcript turns across meetings.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {speakers.map((spk) => {
                  const isSelected = selectedSpeakerHistory?.participant?.id === spk.id;
                  const initials = spk.name
                    ? spk.name
                        .split(' ')
                        .map((n: string) => n[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()
                    : 'U';

                  return (
                    <div
                      key={spk.id}
                      className={`p-5 rounded-xl bg-[#0f172a] border transition flex flex-col justify-between space-y-4 ${
                        isSelected
                          ? 'border-indigo-500/80 shadow-md shadow-indigo-950/40 bg-slate-900/70'
                          : 'border-slate-800 hover:border-slate-700 hover:bg-slate-900/40'
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center font-bold text-xs text-indigo-300">
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-semibold text-sm text-white truncate max-w-[160px] sm:max-w-xs">
                                {spk.name}
                              </h3>
                              {spk.email ? (
                                <p className="text-[11px] text-slate-400 truncate font-mono">{spk.email}</p>
                              ) : (
                                <p className="text-[11px] text-slate-400 italic">No email registered</p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEditModal(spk)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                              title="Edit profile"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteSpeaker(spk.id, spk.name)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
                              title="Delete profile"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {spk.description && (
                          <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                            {spk.description}
                          </p>
                        )}
                      </div>

                      <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-3 text-slate-400 font-mono">
                          <span title="Total Meetings Attended">{spk.total_meetings || 0} meetings</span>
                          <span>•</span>
                          <span title="Speaking Time">{formatSeconds(spk.total_talk_time_seconds)}</span>
                        </div>

                        <button
                          onClick={() => handleViewHistory(spk)}
                          className={`flex items-center gap-1 font-semibold transition ${
                            isSelected ? 'text-indigo-300' : 'text-indigo-400 hover:text-indigo-300'
                          }`}
                        >
                          <span>Appearances</span>
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
          <div className="w-full lg:w-96 flex-shrink-0 bg-[#0f172a] border border-slate-800 rounded-xl overflow-hidden flex flex-col">
            {selectedSpeakerHistory ? (
              <div className="flex flex-col">
                {/* Drawer Header */}
                <div className="p-4 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-300 font-bold text-xs">
                      {selectedSpeakerHistory.participant.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-semibold text-xs text-white">
                        {selectedSpeakerHistory.participant.name}
                      </h4>
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
                <div className="p-4 space-y-4 max-h-[600px] overflow-y-auto">
                  {/* Stats Summary */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-center">
                      <span className="text-[10px] text-slate-400 uppercase font-mono">Meetings</span>
                      <p className="text-base font-bold text-white mt-0.5">
                        {selectedSpeakerHistory.participant.total_meetings}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-center">
                      <span className="text-[10px] text-slate-400 uppercase font-mono">Speaking Time</span>
                      <p className="text-base font-bold text-indigo-400 mt-0.5">
                        {formatSeconds(selectedSpeakerHistory.participant.total_talk_time_seconds)}
                      </p>
                    </div>
                  </div>

                  {/* Meetings List */}
                  <div className="space-y-2">
                    <h5 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-indigo-400" />
                      <span>Meeting Appearances</span>
                    </h5>
                    {selectedSpeakerHistory.appearances.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No appearances recorded yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {selectedSpeakerHistory.appearances.map((app: any) => (
                          <Link
                            key={app.meeting_id}
                            href={`/meetings/${app.meeting_id}`}
                            className="block p-3 rounded-lg bg-slate-950 border border-slate-800 hover:border-indigo-500/50 transition group"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-slate-200 group-hover:text-white truncate max-w-[180px]">
                                {app.meeting_title}
                              </span>
                              <span className="text-[10px] font-mono text-indigo-300 bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-800/40">
                                {app.speaker_label}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                              <span>{app.segment_count} turns</span>
                              <span>{formatSeconds(app.talk_time_seconds)}</span>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Recent Spoken Segments */}
                  <div className="space-y-2">
                    <h5 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-indigo-400" />
                      <span>Recent Spoken Turns</span>
                    </h5>
                    {selectedSpeakerHistory.recent_segments.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No transcript segments recorded.</p>
                    ) : (
                      <div className="space-y-2">
                        {selectedSpeakerHistory.recent_segments.slice(0, 8).map((seg: any) => (
                          <div key={seg.id} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs">
                            <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1 font-mono">
                              <span className="text-indigo-400">
                                [{Math.floor(seg.start_time / 60)}:{(Math.floor(seg.start_time % 60)).toString().padStart(2, '0')}]
                              </span>
                              <span>{seg.speaker_label}</span>
                            </div>
                            <p className="text-slate-300 leading-relaxed text-[11px] font-sans">{seg.text}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400 space-y-2 my-auto">
                <Activity className="h-8 w-8 text-slate-700 mx-auto" />
                <p className="text-xs font-semibold text-slate-300">Select a speaker profile</p>
                <p className="text-[11px] text-slate-400 leading-relaxed max-w-xs mx-auto">
                  Click 'Appearances' on any speaker card to inspect meeting history, speaking time, and verified dialogue quotes.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CREATE SPEAKER MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col text-slate-100">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
              <h3 className="font-semibold text-sm text-white">Create Speaker Profile</h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {formError && (
              <div className="mx-6 mt-4 p-3 rounded-lg bg-rose-950/40 border border-rose-800/40 text-rose-300 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateSpeaker} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Full Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Sarah Connor"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Email Address <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="e.g. sarah@acme.com"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Title or Description <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="e.g. Staff Platform Architect"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={formSubmitting}
                  className="px-3.5 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting || !formName.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
                >
                  {formSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Create Profile</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT SPEAKER MODAL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col text-slate-100">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
              <h3 className="font-semibold text-sm text-white">Edit Speaker Profile</h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {formError && (
              <div className="mx-6 mt-4 p-3 rounded-lg bg-rose-950/40 border border-rose-800/40 text-rose-300 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleEditSpeaker} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Full Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Email Address <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Title or Description <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  disabled={formSubmitting}
                  className="px-3.5 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting || !formName.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
                >
                  {formSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
