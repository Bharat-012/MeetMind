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
          className="flex items-center gap-2 px-5 py-2.5 gradient-purple-hero text-white rounded-full text-xs font-semibold shadow-purple-btn hover:opacity-95 transition"
        >
          <UserPlus className="h-4 w-4" />
          <span>New Speaker</span>
        </button>
      }
    >
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
        {/* Search & Actions Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-[#77738A]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search speakers by name, email, or role..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#E9E4F2] rounded-2xl text-xs text-[#252238] placeholder-[#9D99AF] focus:outline-none focus:border-[#8B45D6] shadow-sm transition"
            />
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-[#E9E4F2] text-xs text-[#77738A] font-medium shadow-sm">
            <Users className="h-3.5 w-3.5 text-[#8B45D6]" />
            <span>{speakers.length} confirmed profiles</span>
          </div>
        </div>

        {/* Main Content Layout with Side-by-Side Drawer */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Left Column: Speaker Cards Grid */}
          <div className="flex-1 w-full">
            {loading ? (
              <div className="p-12 text-center rounded-3xl border border-[#E9E4F2] bg-white text-xs text-[#77738A] shadow-soft-card">
                <Loader2 className="h-6 w-6 animate-spin text-[#8B45D6] mx-auto mb-2" />
                <span>Loading speakers...</span>
              </div>
            ) : speakers.length === 0 ? (
              <div className="p-12 text-center rounded-3xl border border-dashed border-[#DDD5FF] bg-white shadow-soft-card space-y-3">
                <div className="h-12 w-12 rounded-2xl bg-[#F3ECFE] text-[#8B45D6] flex items-center justify-center mx-auto">
                  <Users className="h-6 w-6" />
                </div>
                <p className="text-sm font-bold text-[#252238]">No speakers found</p>
                <p className="text-xs text-[#77738A] max-w-xs mx-auto">
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
                      className={`p-6 rounded-3xl bg-white border transition flex flex-col justify-between space-y-4 shadow-soft-card ${
                        isSelected
                          ? 'border-[#8B45D6] shadow-soft-elevated ring-2 ring-[#8B45D6]/20'
                          : 'border-[#E9E4F2] hover:border-[#DDD5FF] hover:shadow-soft-elevated'
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-12 w-12 rounded-2xl bg-[#F3ECFE] border border-[#E5D7FD] flex items-center justify-center font-bold text-sm text-[#8B45D6] shadow-sm">
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-bold text-sm text-[#252238] truncate max-w-[160px] sm:max-w-xs">
                                {spk.name}
                              </h3>
                              {spk.email ? (
                                <p className="text-xs text-[#77738A] truncate font-mono">{spk.email}</p>
                              ) : (
                                <p className="text-xs text-[#9D99AF] italic">No email registered</p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEditModal(spk)}
                              className="p-2 rounded-xl text-[#77738A] hover:text-[#252238] hover:bg-[#F3F0FF] transition"
                              title="Edit profile"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteSpeaker(spk.id, spk.name)}
                              className="p-2 rounded-xl text-[#77738A] hover:text-[#BE123C] hover:bg-[#FDF0F4] transition"
                              title="Delete profile"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        {spk.description && (
                          <p className="text-xs text-[#77738A] line-clamp-2 leading-relaxed bg-[#FAF8FF] p-2.5 rounded-xl border border-[#E9E4F2]">
                            {spk.description}
                          </p>
                        )}
                      </div>

                      <div className="pt-3 border-t border-[#E9E4F2] flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 text-[#77738A]">
                          <span className="px-2 py-0.5 rounded-lg bg-[#F3F0FF] text-[#252238] font-medium" title="Total Meetings Attended">
                            {spk.total_meetings || 0} meetings
                          </span>
                          <span className="px-2 py-0.5 rounded-lg bg-[#F3ECFE] text-[#8B45D6] font-medium" title="Speaking Time">
                            {formatSeconds(spk.total_talk_time_seconds)}
                          </span>
                        </div>

                        <button
                          onClick={() => handleViewHistory(spk)}
                          className={`flex items-center gap-1 font-semibold text-xs transition ${
                            isSelected ? 'text-[#8B45D6]' : 'text-[#8B45D6] hover:text-[#7135C5]'
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
          <div className="w-full lg:w-96 flex-shrink-0 bg-white border border-[#E9E4F2] rounded-3xl shadow-soft-card overflow-hidden flex flex-col">
            {selectedSpeakerHistory ? (
              <div className="flex flex-col">
                {/* Drawer Header */}
                <div className="p-5 border-b border-[#E9E4F2] bg-gradient-to-r from-white via-[#FAF8FF] to-white flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-[#F3ECFE] border border-[#E5D7FD] flex items-center justify-center text-[#8B45D6] font-bold text-sm shadow-sm">
                      {selectedSpeakerHistory.participant.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-[#252238]">
                        {selectedSpeakerHistory.participant.name}
                      </h4>
                      <p className="text-xs text-[#77738A]">Participation History</p>
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedSpeakerHistory(null)}
                    className="p-1.5 rounded-xl text-[#77738A] hover:text-[#252238] hover:bg-[#F3F0FF] transition"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Drawer Body */}
                <div className="p-5 space-y-5 max-h-[600px] overflow-y-auto">
                  {/* Stats Summary */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 rounded-2xl bg-[#F3F0FF] border border-[#E9E4F2] text-center">
                      <span className="text-[11px] text-[#77738A] uppercase font-semibold">Meetings</span>
                      <p className="text-xl font-bold text-[#252238] mt-0.5">
                        {selectedSpeakerHistory.participant.total_meetings}
                      </p>
                    </div>
                    <div className="p-4 rounded-2xl bg-[#F3ECFE] border border-[#E5D7FD] text-center">
                      <span className="text-[11px] text-[#8B45D6] uppercase font-semibold">Speaking Time</span>
                      <p className="text-xl font-bold text-[#8B45D6] mt-0.5">
                        {formatSeconds(selectedSpeakerHistory.participant.total_talk_time_seconds)}
                      </p>
                    </div>
                  </div>

                  {/* Meetings List */}
                  <div className="space-y-3">
                    <h5 className="text-xs font-bold text-[#252238] flex items-center gap-1.5">
                      <Calendar className="h-4 w-4 text-[#8B45D6]" />
                      <span>Meeting Appearances</span>
                    </h5>
                    {selectedSpeakerHistory.appearances.length === 0 ? (
                      <p className="text-xs text-[#77738A] italic">No appearances recorded yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {selectedSpeakerHistory.appearances.map((app: any) => (
                          <Link
                            key={app.meeting_id}
                            href={`/meetings/${app.meeting_id}`}
                            className="block p-3.5 rounded-2xl bg-[#FAF8FF] border border-[#E9E4F2] hover:border-[#8B45D6] transition group"
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-semibold text-[#252238] group-hover:text-[#8B45D6] truncate max-w-[180px]">
                                {app.meeting_title}
                              </span>
                              <span className="text-[10px] font-mono text-[#8B45D6] bg-[#F3ECFE] px-2 py-0.5 rounded-full border border-[#E5D7FD]">
                                {app.speaker_label}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-xs text-[#77738A]">
                              <span>{app.segment_count} turns</span>
                              <span className="font-medium text-[#252238]">{formatSeconds(app.talk_time_seconds)}</span>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Recent Spoken Segments */}
                  <div className="space-y-3">
                    <h5 className="text-xs font-bold text-[#252238] flex items-center gap-1.5">
                      <FileText className="h-4 w-4 text-[#8B45D6]" />
                      <span>Recent Spoken Turns</span>
                    </h5>
                    {selectedSpeakerHistory.recent_segments.length === 0 ? (
                      <p className="text-xs text-[#77738A] italic">No transcript segments recorded.</p>
                    ) : (
                      <div className="space-y-2.5">
                        {selectedSpeakerHistory.recent_segments.slice(0, 8).map((seg: any) => (
                          <div key={seg.id} className="p-3.5 rounded-2xl bg-[#FAF8FF] border border-[#E9E4F2] text-xs space-y-1">
                            <div className="flex items-center justify-between text-[11px] text-[#77738A] font-mono">
                              <span className="text-[#8B45D6] font-semibold">
                                [{Math.floor(seg.start_time / 60)}:{(Math.floor(seg.start_time % 60)).toString().padStart(2, '0')}]
                              </span>
                              <span>{seg.speaker_label}</span>
                            </div>
                            <p className="text-[#252238] leading-relaxed text-xs">{seg.text}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-10 text-center text-[#77738A] space-y-3 my-auto">
                <div className="h-12 w-12 rounded-2xl bg-[#F3ECFE] text-[#8B45D6] flex items-center justify-center mx-auto">
                  <Activity className="h-6 w-6" />
                </div>
                <p className="text-sm font-bold text-[#252238]">Select a speaker profile</p>
                <p className="text-xs text-[#77738A] leading-relaxed max-w-xs mx-auto">
                  Click 'Appearances' on any speaker card to inspect meeting history, speaking time, and verified dialogue quotes.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CREATE SPEAKER MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#252238]/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white border border-[#E9E4F2] rounded-3xl w-full max-w-md shadow-soft-elevated overflow-hidden flex flex-col text-[#252238]">
            <div className="px-6 py-5 border-b border-[#E9E4F2] flex items-center justify-between bg-gradient-to-r from-white via-[#FAF8FF] to-white">
              <h3 className="font-bold text-base text-[#252238]">Create Speaker Profile</h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-[#77738A] hover:text-[#252238] p-2 rounded-xl hover:bg-[#F3F0FF] transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {formError && (
              <div className="mx-6 mt-4 p-3 rounded-2xl bg-[#FDF0F4] border border-[#FBCFE8] text-[#BE123C] text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateSpeaker} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-[#252238] block mb-1">
                  Full Name <span className="text-[#BE123C]">*</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Sarah Connor"
                  className="w-full px-4 py-2.5 bg-[#FAF8FF] border border-[#E9E4F2] rounded-2xl text-xs text-[#252238] placeholder-[#9D99AF] focus:outline-none focus:border-[#8B45D6] focus:bg-white transition"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#252238] block mb-1">
                  Email Address <span className="text-[#9D99AF] font-normal">(optional)</span>
                </label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="e.g. sarah@acme.com"
                  className="w-full px-4 py-2.5 bg-[#FAF8FF] border border-[#E9E4F2] rounded-2xl text-xs text-[#252238] placeholder-[#9D99AF] focus:outline-none focus:border-[#8B45D6] focus:bg-white font-mono transition"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#252238] block mb-1">
                  Title or Description <span className="text-[#9D99AF] font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="e.g. Staff Platform Architect"
                  className="w-full px-4 py-2.5 bg-[#FAF8FF] border border-[#E9E4F2] rounded-2xl text-xs text-[#252238] placeholder-[#9D99AF] focus:outline-none focus:border-[#8B45D6] focus:bg-white transition"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-[#E9E4F2]">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={formSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-[#77738A] hover:text-[#252238] rounded-xl hover:bg-[#F3F0FF] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting || !formName.trim()}
                  className="px-5 py-2.5 gradient-purple-hero text-white rounded-2xl text-xs font-semibold shadow-purple-btn disabled:opacity-50 transition flex items-center gap-2"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#252238]/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white border border-[#E9E4F2] rounded-3xl w-full max-w-md shadow-soft-elevated overflow-hidden flex flex-col text-[#252238]">
            <div className="px-6 py-5 border-b border-[#E9E4F2] flex items-center justify-between bg-gradient-to-r from-white via-[#FAF8FF] to-white">
              <h3 className="font-bold text-base text-[#252238]">Edit Speaker Profile</h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-[#77738A] hover:text-[#252238] p-2 rounded-xl hover:bg-[#F3F0FF] transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {formError && (
              <div className="mx-6 mt-4 p-3 rounded-2xl bg-[#FDF0F4] border border-[#FBCFE8] text-[#BE123C] text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleEditSpeaker} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-[#252238] block mb-1">
                  Full Name <span className="text-[#BE123C]">*</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#FAF8FF] border border-[#E9E4F2] rounded-2xl text-xs text-[#252238] placeholder-[#9D99AF] focus:outline-none focus:border-[#8B45D6] focus:bg-white transition"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#252238] block mb-1">
                  Email Address <span className="text-[#9D99AF] font-normal">(optional)</span>
                </label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#FAF8FF] border border-[#E9E4F2] rounded-2xl text-xs text-[#252238] placeholder-[#9D99AF] focus:outline-none focus:border-[#8B45D6] focus:bg-white font-mono transition"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#252238] block mb-1">
                  Title or Description <span className="text-[#9D99AF] font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#FAF8FF] border border-[#E9E4F2] rounded-2xl text-xs text-[#252238] placeholder-[#9D99AF] focus:outline-none focus:border-[#8B45D6] focus:bg-white transition"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-[#E9E4F2]">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  disabled={formSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-[#77738A] hover:text-[#252238] rounded-xl hover:bg-[#F3F0FF] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting || !formName.trim()}
                  className="px-5 py-2.5 gradient-purple-hero text-white rounded-2xl text-xs font-semibold shadow-purple-btn disabled:opacity-50 transition flex items-center gap-2"
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
