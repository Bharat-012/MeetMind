'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  HelpCircle,
  Calendar,
  User,
  FileText,
  Clock,
  CheckCircle2,
  ListTodo,
  Users,
  MessageSquare,
  Activity,
  Play,
  Pause,
  RotateCcw,
  Search,
  ExternalLink,
  ChevronLeft,
  Sparkles,
  AlertTriangle,
  ArrowRight,
  Edit2,
  Check,
  X,
  History,
  UserCheck,
  UserX,
  BarChart3,
  ShieldCheck
} from 'lucide-react';

export default function MeetingDetailPage() {
  const params = useParams();
  const meetingId = params?.id as string;

  const [activeTab, setActiveTab] = useState<string>('transcript');
  const [meeting, setMeeting] = useState<any>(null);
  const [transcriptData, setTranscriptData] = useState<any>(null);
  const [summaryData, setSummaryData] = useState<any>(null);
  const [shortTranscript, setShortTranscript] = useState<any>(null);
  const [decisions, setDecisions] = useState<any[]>([]);
  const [actionItems, setActionItems] = useState<any[]>([]);
  const [speakerStats, setSpeakerStats] = useState<any[]>([]);
  const [orgParticipants, setOrgParticipants] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRegenerating, setIsRegenerating] = useState<boolean>(false);

  // Playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(75);
  const playbackTimerRef = useRef<any>(null);

  // Speaker assignment modal state
  const [assignModalOpen, setAssignModalOpen] = useState<boolean>(false);
  const [selectedSpeaker, setSelectedSpeaker] = useState<any>(null);
  const [selectedParticipantId, setSelectedParticipantId] = useState<string>('');
  const [customConfirmedName, setCustomConfirmedName] = useState<string>('');
  const [assignNotes, setAssignNotes] = useState<string>('');
  const [assignError, setAssignError] = useState<string>('');

  // Speaker audit modal state
  const [auditModalOpen, setAuditModalOpen] = useState<boolean>(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditSpeakerLabel, setAuditSpeakerLabel] = useState<string>('');

  // Chat state
  const [chatMessages, setChatMessages] = useState<any[]>([
    {
      role: 'assistant',
      content: 'Hello! I am MeetMind Assistant. You can ask me any question about this meeting with timestamped citations.',
      citations: []
    }
  ]);
  const [chatQuery, setChatQuery] = useState<string>('');
  const [chatLoading, setChatLoading] = useState<boolean>(false);

  // Filters
  const [transcriptSearch, setTranscriptSearch] = useState<string>('');
  const [speakerFilter, setSpeakerFilter] = useState<string>('ALL');

  const fetchMeetingData = async () => {
    try {
      const [mRes, tRes, sRes, stRes, dRes, aRes, statRes] = await Promise.all([
        fetch(`http://localhost:8000/api/meetings/${meetingId}`).catch(() => null),
        fetch(`http://localhost:8000/api/meetings/${meetingId}/transcript`).catch(() => null),
        fetch(`http://localhost:8000/api/meetings/${meetingId}/summary`).catch(() => null),
        fetch(`http://localhost:8000/api/meetings/${meetingId}/short-transcript`).catch(() => null),
        fetch(`http://localhost:8000/api/meetings/${meetingId}/decisions`).catch(() => null),
        fetch(`http://localhost:8000/api/meetings/${meetingId}/action-items`).catch(() => null),
        fetch(`http://localhost:8000/api/meetings/${meetingId}/speakers/stats`).catch(() => null),
      ]);

      let meetingObj = null;
      if (mRes && mRes.ok) {
        meetingObj = await mRes.json();
        setMeeting(meetingObj);
        if (meetingObj.duration_seconds) setDuration(Math.round(meetingObj.duration_seconds));
      }

      if (tRes && tRes.ok) setTranscriptData(await tRes.json());
      if (sRes && sRes.ok) setSummaryData(await sRes.json());
      if (stRes && stRes.ok) setShortTranscript(await stRes.json());
      if (dRes && dRes.ok) setDecisions(await dRes.json());
      if (aRes && aRes.ok) setActionItems(await aRes.json());
      if (statRes && statRes.ok) setSpeakerStats(await statRes.json());

      // Fetch organization speaker directory profiles
      if (meetingObj?.organization_id) {
        fetch(`http://localhost:8000/api/organizations/${meetingObj.organization_id}/speakers`)
          .then((res) => (res.ok ? res.json() : []))
          .then((data) => setOrgParticipants(data))
          .catch(() => {});
      }
    } catch (err) {
      console.error('Failed fetching meeting details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!meetingId) return;
    fetchMeetingData();
  }, [meetingId]);

  // Synchronized playback timer simulator
  useEffect(() => {
    if (isPlaying) {
      playbackTimerRef.current = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= duration) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    }
    return () => {
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    };
  }, [isPlaying, duration]);

  const seekTo = (seconds: number) => {
    setCurrentTime(seconds);
    setIsPlaying(true);
  };

  const openAssignModal = (speaker: any) => {
    setSelectedSpeaker(speaker);
    setSelectedParticipantId(speaker.participant_id || '');
    setCustomConfirmedName(speaker.confirmed_name || '');
    setAssignNotes('');
    setAssignError('');
    setAssignModalOpen(true);
  };

  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSpeaker) return;
    setAssignError('');

    let nameToSave = customConfirmedName.trim();
    if (selectedParticipantId) {
      const match = orgParticipants.find((p) => p.id === selectedParticipantId);
      if (match && !nameToSave) nameToSave = match.name;
    }

    if (!nameToSave) {
      setAssignError('Please select a profile or enter a confirmed display name.');
      return;
    }

    try {
      const res = await fetch(`http://localhost:8000/api/meetings/${meetingId}/speakers/${selectedSpeaker.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmed_name: nameToSave,
          participant_id: selectedParticipantId || null,
          notes: assignNotes.trim() || null
        })
      });

      if (res.ok) {
        setAssignModalOpen(false);
        fetchMeetingData();
      } else {
        const data = await res.json();
        setAssignError(data.detail || 'Failed to update assignment');
      }
    } catch (err: any) {
      setAssignError(err.message || 'Error saving assignment');
    }
  };

  const handleUnassignSpeaker = async (speakerId: string) => {
    if (!confirm('Revert this speaker to an unassigned anonymous state?')) return;
    try {
      const res = await fetch(`http://localhost:8000/api/meetings/${meetingId}/speakers/${speakerId}/unassign`, {
        method: 'POST'
      });
      if (res.ok) {
        fetchMeetingData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenAuditHistory = async (speaker: any) => {
    setAuditSpeakerLabel(speaker.speaker_label);
    setAuditModalOpen(true);
    setAuditLogs([]);
    try {
      const res = await fetch(`http://localhost:8000/api/meetings/${meetingId}/speakers/${speaker.id}/audit-history`);
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleActionItemToggle = async (actionId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'COMPLETED' ? 'OPEN' : 'COMPLETED';
    try {
      const res = await fetch(`http://localhost:8000/api/meetings/${meetingId}/action-items/${actionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        const updated = await res.json();
        setActionItems((prev) => prev.map((a) => a.id === actionId ? updated : a));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRegenerateIntelligence = async () => {
    setIsRegenerating(true);
    try {
      const res = await fetch(`http://localhost:8000/api/meetings/${meetingId}/regenerate-intelligence`, {
        method: 'POST'
      });
      if (res.ok) {
        await fetchMeetingData();
      }
    } catch (err) {
      console.error('Failed to regenerate intelligence:', err);
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatQuery.trim()) return;

    const userText = chatQuery;
    setChatQuery('');
    setChatMessages((prev) => [...prev, { role: 'user', content: userText }]);
    setChatLoading(true);

    try {
      const res = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: userText,
          meeting_id: meetingId,
          scope: 'SINGLE_MEETING'
        })
      });

      if (res.ok) {
        const data = await res.json();
        setChatMessages((prev) => [
          ...prev,
          { role: 'assistant', content: data.answer, citations: data.citations || [] }
        ]);
      }
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Could not connect to meeting intelligence engine.', citations: [] }
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Filtered segments
  const filteredSegments = (transcriptData?.segments || []).filter((seg: any) => {
    const matchesSearch = !transcriptSearch || seg.text.toLowerCase().includes(transcriptSearch.toLowerCase());
    const matchesSpeaker =
      speakerFilter === 'ALL' ||
      seg.speaker_id === speakerFilter ||
      seg.speaker_label === speakerFilter;
    return matchesSearch && matchesSpeaker;
  });

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 overflow-hidden font-sans">
      {/* Main Workspace Layout */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-950">
        {/* Top Header */}
        <header className="h-14 border-b border-slate-800 bg-slate-900/60 px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/workspace"
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition flex items-center gap-1 text-xs"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Workspace</span>
            </Link>
            <div className="h-4 w-[1px] bg-slate-800" />
            <h1 className="font-semibold text-sm text-white truncate max-w-md">
              {meeting?.title || 'Meeting Details'}
            </h1>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-indigo-950/60 text-indigo-400 border border-indigo-800/40">
              {meeting?.status}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRegenerateIntelligence}
              disabled={isRegenerating}
              className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white font-medium px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 transition disabled:opacity-50"
            >
              <Sparkles className={`h-3.5 w-3.5 text-indigo-400 ${isRegenerating ? 'animate-spin' : ''}`} />
              <span>{isRegenerating ? 'Regenerating...' : 'Regenerate Intelligence'}</span>
            </button>
            <Link
              href="/speakers"
              className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-medium px-2.5 py-1.5 rounded-lg border border-indigo-900/40 bg-indigo-950/30 hover:bg-indigo-950/50 transition"
            >
              <Users className="h-3.5 w-3.5" />
              <span>Speaker Directory</span>
            </Link>
          </div>
        </header>

        {/* Media Player Sync Bar */}
        <div className="bg-slate-950 border-b border-slate-800 px-6 py-3 flex items-center gap-4">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="h-9 w-9 rounded-full bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center text-white transition shadow-md shadow-indigo-600/30"
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
          </button>

          <span className="text-xs font-mono text-slate-300 w-12 text-right">
            {formatTime(currentTime)}
          </span>

          <div className="flex-1 relative flex items-center">
            <input
              type="range"
              min="0"
              max={duration}
              value={currentTime}
              onChange={(e) => seekTo(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

          <span className="text-xs font-mono text-slate-400 w-12">
            {formatTime(duration)}
          </span>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-6 overflow-x-auto">
          {[
            { id: 'transcript', label: '1. Full Transcript', icon: FileText },
            { id: 'short_transcript', label: '2. Chronological Explanation', icon: Clock },
            { id: 'summary', label: '3. Structured Summary', icon: Sparkles },
            { id: 'decisions', label: 'Decisions', icon: CheckCircle2, badge: decisions.length },
            { id: 'actions', label: 'Action Items', icon: ListTodo, badge: actionItems.length },
            { id: 'speakers', label: 'Speakers & Attribution', icon: Users, badge: transcriptData?.speakers?.length },
            { id: 'chat', label: 'Meeting Chat', icon: MessageSquare },
            { id: 'voice_emotion', label: 'Voice Analysis', icon: Activity },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-3 px-4 text-xs font-medium border-b-2 flex items-center gap-2 whitespace-nowrap transition ${
                  active
                    ? 'border-indigo-500 text-indigo-400 bg-slate-900/30'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-500/20 text-indigo-300 font-semibold">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Content Display Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* TAB 1: FULL TRANSCRIPT */}
          {activeTab === 'transcript' && (
            <div className="space-y-4 max-w-4xl mx-auto">
              {/* Filter controls */}
              <div className="flex items-center justify-between gap-4 mb-4">
                <div className="relative flex-1 max-w-md">
                  <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    value={transcriptSearch}
                    onChange={(e) => setTranscriptSearch(e.target.value)}
                    placeholder="Search spoken words in transcript..."
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Speaker:</span>
                  <select
                    value={speakerFilter}
                    onChange={(e) => setSpeakerFilter(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="ALL">All Speakers</option>
                    {(transcriptData?.speakers || []).map((spk: any) => (
                      <option key={spk.id} value={spk.id}>
                        {spk.confirmed_name ? `${spk.confirmed_name} (${spk.speaker_label})` : `Unassigned · ${spk.speaker_label}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Segments List */}
              <div className="space-y-3">
                {filteredSegments.map((seg: any) => {
                  const isCurrent = currentTime >= seg.start_time && currentTime <= seg.end_time;
                  return (
                    <div
                      key={seg.id}
                      onClick={() => seekTo(seg.start_time)}
                      className={`p-4 rounded-xl border transition cursor-pointer ${
                        isCurrent
                          ? 'bg-indigo-950/40 border-indigo-500/50 shadow-md shadow-indigo-950/50'
                          : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                            seg.is_confirmed
                              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40'
                              : 'bg-slate-800 text-indigo-300 border border-slate-700'
                          }`}>
                            {seg.is_confirmed ? <ShieldCheck className="h-3 w-3 text-emerald-400" /> : null}
                            <span>{seg.speaker_name || seg.speaker_label || 'Speaker'}</span>
                          </span>

                          {seg.speaker_label && seg.speaker_name !== seg.speaker_label && (
                            <span className="text-[10px] font-mono text-slate-500">
                              ({seg.speaker_label})
                            </span>
                          )}
                        </div>

                        <span className="text-xs font-mono text-slate-500">
                          {formatTime(seg.start_time)} - {formatTime(seg.end_time)}
                        </span>
                      </div>
                      <p className="text-sm text-slate-200 leading-relaxed">{seg.text}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: CHRONOLOGICAL EXPLANATION */}
          {activeTab === 'short_transcript' && (
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="p-6 rounded-2xl bg-indigo-950/30 border border-indigo-900/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm">
                    <Clock className="h-4 w-4" />
                    <span>Chronological Meeting Explanation</span>
                  </div>
                  {shortTranscript?.model_name && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-900/40 text-indigo-300 border border-indigo-700/50">
                      {shortTranscript.model_name}
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-200 leading-relaxed font-sans">
                  {shortTranscript?.narrative_text || 'Chronological explanation will appear here once processed.'}
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Event Sequence & Speaker Flow</h3>
                  <span className="text-xs text-slate-400">{(shortTranscript?.chronological_events || []).length} events recorded</span>
                </div>

                {(!shortTranscript?.chronological_events || shortTranscript.chronological_events.length === 0) ? (
                  <div className="p-8 text-center rounded-xl bg-slate-950/40 border border-slate-800 text-slate-400 text-xs">
                    No chronological events extracted yet.
                  </div>
                ) : (
                  <div className="border-l-2 border-slate-800 pl-4 space-y-6">
                    {shortTranscript.chronological_events.map((ev: any, idx: number) => {
                      const typeColors: Record<string, string> = {
                        proposal: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
                        agreement: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
                        disagreement: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
                        question: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
                        clarification: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
                        conclusion: 'bg-teal-500/15 text-teal-400 border-teal-500/30',
                        contribution: 'bg-slate-800 text-slate-300 border-slate-700'
                      };
                      const badgeClass = typeColors[ev.event_type] || typeColors.contribution;

                      return (
                        <div key={idx} className="relative group cursor-pointer" onClick={() => seekTo(ev.timestamp)}>
                          <div className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-indigo-500 group-hover:scale-125 transition shadow-sm shadow-indigo-500/50" />
                          <div className="flex flex-wrap items-center gap-2 mb-1.5">
                            <span className="text-xs font-mono text-indigo-400 hover:underline">
                              [{formatTime(ev.timestamp)}]
                            </span>
                            <span className="text-xs font-semibold text-white">{ev.speaker}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ${badgeClass}`}>
                              {ev.event_type || 'contribution'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed">{ev.description}</p>
                          {ev.evidence_quote && (
                            <div className="mt-1.5 text-[11px] text-slate-400 italic bg-slate-900/60 p-2 rounded border border-slate-800/80">
                              "{ev.evidence_quote}"
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: STRUCTURED SUMMARY */}
          {activeTab === 'summary' && (
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="p-6 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs uppercase tracking-wider text-indigo-400 font-bold">Executive Summary</h3>
                  {summaryData?.model_name && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/50">
                      {summaryData.model_name}
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-200 leading-relaxed font-sans">
                  {summaryData?.executive_summary || 'Summary is being computed...'}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Key Points */}
                <div className="p-5 rounded-xl bg-slate-950/40 border border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-indigo-400" />
                    <span>Key Takeaways</span>
                  </h4>
                  {(!summaryData?.key_points || summaryData.key_points.length === 0) ? (
                    <p className="text-xs text-slate-500 italic">No key points extracted.</p>
                  ) : (
                    <ul className="space-y-2">
                      {summaryData.key_points.map((pt: string, i: number) => (
                        <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0" />
                          <span>{pt}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Risks & Considerations */}
                <div className="p-5 rounded-xl bg-slate-950/40 border border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                    <span>Risks & Blockers</span>
                  </h4>
                  {(!summaryData?.risks || summaryData.risks.length === 0) ? (
                    <p className="text-xs text-slate-500 italic">No specific risks flagged.</p>
                  ) : (
                    <ul className="space-y-2">
                      {summaryData.risks.map((risk: string, i: number) => (
                        <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                          <span>{risk}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Open Questions */}
                <div className="p-5 rounded-xl bg-slate-950/40 border border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <HelpCircle className="h-3.5 w-3.5 text-purple-400" />
                    <span>Open Questions & Unresolved Issues</span>
                  </h4>
                  {(!summaryData?.open_questions || summaryData.open_questions.length === 0) ? (
                    <p className="text-xs text-slate-500 italic">No unresolved questions detected.</p>
                  ) : (
                    <ul className="space-y-2">
                      {summaryData.open_questions.map((q: string, i: number) => (
                        <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-purple-500 mt-1.5 flex-shrink-0" />
                          <span>{q}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Next Steps */}
                <div className="p-5 rounded-xl bg-slate-950/40 border border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <ArrowRight className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Next Steps</span>
                  </h4>
                  {(!summaryData?.next_steps || summaryData.next_steps.length === 0) ? (
                    <p className="text-xs text-slate-500 italic">No next steps defined.</p>
                  ) : (
                    <ul className="space-y-2">
                      {summaryData.next_steps.map((step: string, i: number) => (
                        <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: DECISIONS */}
          {activeTab === 'decisions' && (
            <div className="max-w-4xl mx-auto space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Decision Register</h3>
                <span className="text-xs text-slate-400">{decisions.length} recorded</span>
              </div>

              {decisions.length === 0 ? (
                <div className="p-8 text-center rounded-xl bg-slate-950/40 border border-slate-800 text-slate-400 text-xs">
                  No decisions extracted from this meeting yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {decisions.map((dec: any) => {
                    const statusStyles: Record<string, string> = {
                      CONFIRMED: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
                      ACTIVE: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
                      PROPOSED: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
                      REJECTED: 'bg-red-500/15 text-red-400 border-red-500/30',
                      SUPERSEDED: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
                      CANCELLED: 'bg-slate-700 text-slate-400 border-slate-600'
                    };
                    const statusClass = statusStyles[dec.status] || statusStyles.CONFIRMED;

                    return (
                      <div key={dec.id} className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-indigo-400">{dec.title || dec.category || 'General'}</span>
                          <div className="flex items-center gap-2">
                            {dec.model_name && (
                              <span className="text-[10px] font-mono text-slate-500">
                                {dec.model_name}
                              </span>
                            )}
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${statusClass}`}>
                              {dec.status}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-slate-200 leading-relaxed">{dec.decision_text}</p>
                        
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-900 text-xs text-slate-400">
                          <div className="flex items-center gap-1.5">
                            <User className="h-3 w-3 text-slate-500" />
                            <span>Responsible: <strong className="text-slate-300 font-normal">{dec.responsible_person || 'Unassigned'}</strong></span>
                          </div>
                          {dec.evidence_quote && (
                            <button
                              onClick={() => dec.evidence_timestamp !== null && seekTo(dec.evidence_timestamp)}
                              className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-mono"
                            >
                              <span>Evidence: "{dec.evidence_quote.substring(0, 45)}..."</span>
                              {dec.evidence_timestamp !== null && (
                                <span>[{formatTime(dec.evidence_timestamp)}]</span>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: ACTION ITEMS */}
          {activeTab === 'actions' && (
            <div className="max-w-4xl mx-auto space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Action Item Tracker</h3>
                <span className="text-xs text-slate-400">{actionItems.length} items</span>
              </div>

              {actionItems.length === 0 ? (
                <div className="p-8 text-center rounded-xl bg-slate-950/40 border border-slate-800 text-slate-400 text-xs">
                  No action items extracted from this meeting yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {actionItems.map((item: any) => {
                    const isDone = item.status === 'COMPLETED';
                    const priorityStyles: Record<string, string> = {
                      URGENT: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
                      HIGH: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
                      MEDIUM: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
                      LOW: 'bg-slate-800 text-slate-400 border-slate-700'
                    };
                    const priorityClass = priorityStyles[item.priority] || priorityStyles.MEDIUM;

                    return (
                      <div
                        key={item.id}
                        className={`p-4 rounded-xl border flex flex-col gap-3 transition ${
                          isDone ? 'bg-slate-950/20 border-slate-900 opacity-60' : 'bg-slate-950/50 border-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => handleActionItemToggle(item.id, item.status)}
                              className={`h-5 w-5 rounded border flex items-center justify-center transition ${
                                isDone ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-700 hover:border-indigo-500'
                              }`}
                            >
                              {isDone && <Check className="h-3 w-3" />}
                            </button>
                            <p className={`text-sm font-medium ${isDone ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                              {item.task_description}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-900 text-slate-300 border border-slate-800">
                              {item.status}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${priorityClass}`}>
                              {item.priority}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-900 text-xs text-slate-400">
                          <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1.5">
                              <User className="h-3 w-3 text-slate-500" />
                              <span>Owner: <strong className="text-slate-300 font-normal">{item.owner_name || 'Unassigned'}</strong></span>
                            </span>
                            <span className="flex items-center gap-1.5">
                              <Calendar className="h-3 w-3 text-slate-500" />
                              <span>Due: <strong className="text-slate-300 font-normal">{item.due_date || 'No deadline'}</strong></span>
                            </span>
                          </div>
                          {item.evidence_quote && (
                            <button
                              onClick={() => item.evidence_timestamp !== null && seekTo(item.evidence_timestamp)}
                              className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-mono"
                            >
                              <span>Evidence: "{item.evidence_quote.substring(0, 45)}..."</span>
                              {item.evidence_timestamp !== null && (
                                <span>[{formatTime(item.evidence_timestamp)}]</span>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 6: SPEAKERS & ATTRIBUTION */}
          {activeTab === 'speakers' && (
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Speaker Contribution Stats */}
              {speakerStats.length > 0 && (
                <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-4">
                  <h3 className="text-xs uppercase tracking-wider text-slate-400 font-bold flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-indigo-400" />
                    <span>Meeting Talk-Time Distribution</span>
                  </h3>

                  {/* Distribution Bar */}
                  <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden flex">
                    {speakerStats.map((s, idx) => {
                      const colors = ['bg-indigo-500', 'bg-violet-500', 'bg-cyan-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500'];
                      return (
                        <div
                          key={s.speaker_id}
                          style={{ width: `${s.percentage}%` }}
                          className={`${colors[idx % colors.length]} transition-all`}
                          title={`${s.display_name}: ${s.percentage}%`}
                        />
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                    {speakerStats.map((s, idx) => (
                      <div key={s.speaker_id} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-slate-200 truncate">{s.display_name}</span>
                          <span className="font-mono text-indigo-400 font-bold">{s.percentage}%</span>
                        </div>
                        <div className="text-[11px] text-slate-500 flex justify-between">
                          <span>{s.segment_count} segments</span>
                          <span>{formatTime(s.total_seconds)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Speaker List & Assignment Cards */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Diarized Speaker Turns & Confirmations</h3>
                  <span className="text-xs text-slate-500">
                    Diarization IDs remain meeting-scoped until linked to an organization profile.
                  </span>
                </div>

                {(transcriptData?.speakers || []).map((spk: any) => (
                  <div
                    key={spk.id}
                    className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm ${
                        spk.is_confirmed
                          ? 'bg-emerald-950/60 border border-emerald-700/50 text-emerald-300'
                          : 'bg-slate-800 border border-slate-700 text-slate-300'
                      }`}>
                        {(spk.confirmed_name || spk.speaker_label).charAt(0).toUpperCase()}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-sm text-white">
                            {spk.confirmed_name || 'Unassigned Speaker'}
                          </h4>
                          <span className="text-xs font-mono text-slate-500">
                            ({spk.speaker_label})
                          </span>
                          <span className={`px-2 py-0.2 rounded text-[10px] font-semibold ${
                            spk.is_confirmed
                              ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40'
                              : 'bg-amber-950/60 text-amber-400 border border-amber-800/40'
                          }`}>
                            {spk.is_confirmed ? 'Confirmed' : 'Unassigned'}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                          <span>{spk.segment_count || 0} segments</span>
                          <span>•</span>
                          <span>{formatTime(spk.total_talk_time_seconds || 0)}</span>
                          <span>•</span>
                          <span>{spk.talk_time_percentage || 0}% of speech</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenAuditHistory(spk)}
                        className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                        title="View Attribution Audit Trail"
                      >
                        <History className="h-4 w-4" />
                      </button>

                      <button
                        onClick={() => openAssignModal(spk)}
                        className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-700/40 transition"
                      >
                        <UserCheck className="h-3.5 w-3.5" />
                        <span>{spk.is_confirmed ? 'Change' : 'Assign'}</span>
                      </button>

                      {spk.is_confirmed && (
                        <button
                          onClick={() => handleUnassignSpeaker(spk.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition"
                          title="Revert to Anonymous Speaker"
                        >
                          <UserX className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 7: CHAT */}
          {activeTab === 'chat' && (
            <div className="max-w-3xl mx-auto flex flex-col h-[600px] bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden">
              <div className="flex-1 p-4 overflow-y-auto space-y-4">
                {chatMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl p-4 text-xs leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-indigo-600 text-white rounded-br-none'
                          : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none'
                      }`}
                    >
                      <p>{msg.content}</p>

                      {msg.citations && msg.citations.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-800 space-y-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 block">
                            Evidence Citations
                          </span>
                          {msg.citations.map((c: any, ci: number) => (
                            <div
                              key={ci}
                              onClick={() => {
                                const ts = c.timestamp_start !== undefined && c.timestamp_start !== null ? c.timestamp_start : c.timestamp;
                                if (ts !== undefined && ts !== null) seekTo(ts);
                              }}
                              className="text-[11px] text-slate-400 bg-slate-950 p-2 rounded border border-slate-800/80 cursor-pointer hover:border-indigo-500/50 transition flex items-center justify-between"
                            >
                              <span>{c.speaker_name || c.speaker_label || 'Evidence'}: "{c.quote}"</span>
                              {(c.timestamp_start !== null && c.timestamp_start !== undefined) ? (
                                <span className="font-mono text-indigo-400 ml-2">
                                  [{formatTime(c.timestamp_start)}]
                                </span>
                              ) : (c.timestamp !== null && c.timestamp !== undefined ? (
                                <span className="font-mono text-indigo-400 ml-2">
                                  [{formatTime(c.timestamp)}]
                                </span>
                              ) : null)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="text-xs text-slate-500 italic">Synthesizing grounded answer...</div>
                )}
              </div>

              <form onSubmit={handleChatSubmit} className="p-3 border-t border-slate-800 bg-slate-900 flex gap-2">
                <input
                  type="text"
                  placeholder="Ask a question about this meeting..."
                  value={chatQuery}
                  onChange={(e) => setChatQuery(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="submit"
                  disabled={chatLoading}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-4 py-2 rounded-xl font-medium transition"
                >
                  Ask
                </button>
              </form>
            </div>
          )}

          {/* TAB 8: VOICE EMOTION */}
          {activeTab === 'voice_emotion' && (
            <div className="max-w-2xl mx-auto p-8 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-3">
              <Activity className="h-8 w-8 text-indigo-400 mx-auto" />
              <h3 className="text-sm font-semibold text-white">Voice Emotion Analysis (Modular Option)</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                Acoustic pitch, tempo, and tone energy analysis are optional features per ADR-005. Standard local meeting summarization and transcript search remain fully operational without requiring affective inference.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ASSIGN PARTICIPANT MODAL */}
      {assignModalOpen && selectedSpeaker && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-indigo-400" />
                  <span>Assign Speaker Identity</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Mapping diarized turn <span className="font-mono text-indigo-300 font-bold">[{selectedSpeaker.speaker_label}]</span>
                </p>
              </div>
              <button onClick={() => setAssignModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAssignment} className="space-y-4">
              {assignError && (
                <div className="p-2.5 rounded-lg bg-red-950/50 border border-red-800/50 text-red-300 text-xs">
                  {assignError}
                </div>
              )}

              {/* Option 1: Select from Organization Speaker Directory */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Select from Organization Speaker Directory
                </label>
                <select
                  value={selectedParticipantId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedParticipantId(id);
                    if (id) {
                      const match = orgParticipants.find((p) => p.id === id);
                      if (match) setCustomConfirmedName(match.name);
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- Choose Profile or Enter Custom Name Below --</option>
                  {orgParticipants.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.email ? `(${p.email})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Option 2: Custom Confirmed Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Confirmed Display Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Sarah Chen"
                  value={customConfirmedName}
                  onChange={(e) => setCustomConfirmedName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Assignment Note / Reason (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Verified by project lead from agenda"
                  value={assignNotes}
                  onChange={(e) => setAssignNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAssignModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-md shadow-indigo-600/30"
                >
                  Confirm Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AUDIT TRAIL MODAL */}
      {auditModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <History className="h-4 w-4 text-indigo-400" />
                  <span>Attribution Audit History</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Audit changes for speaker <span className="font-mono text-indigo-300">[{auditSpeakerLabel}]</span>
                </p>
              </div>
              <button onClick={() => setAuditModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto space-y-3 pr-1">
              {auditLogs.length === 0 ? (
                <p className="text-xs text-slate-500 italic text-center py-6">
                  No attribution modifications recorded for this speaker yet.
                </p>
              ) : (
                auditLogs.map((log) => (
                  <div key={log.id} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-indigo-400 uppercase text-[10px] tracking-wider">
                        {log.action}
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>

                    {log.previous_name || log.new_name ? (
                      <div className="text-slate-300">
                        {log.previous_name && <span className="line-through text-slate-500 mr-2">{log.previous_name}</span>}
                        {log.new_name && <span className="text-emerald-400 font-semibold">{log.new_name}</span>}
                      </div>
                    ) : null}

                    {log.notes && (
                      <p className="text-[11px] text-slate-400 italic">"{log.notes}"</p>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setAuditModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-white transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
