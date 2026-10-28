'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
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
  Check
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
  const [loading, setLoading] = useState<boolean>(true);

  // Playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(75);
  const playbackTimerRef = useRef<any>(null);

  // Speaker editing state
  const [editingSpeakerId, setEditingSpeakerId] = useState<string | null>(null);
  const [speakerNewName, setSpeakerNewName] = useState<string>('');

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

  useEffect(() => {
    if (!meetingId) return;

    const fetchAllData = async () => {
      try {
        const [mRes, tRes, sRes, stRes, dRes, aRes] = await Promise.all([
          fetch(`http://localhost:8000/api/meetings/${meetingId}`).catch(() => null),
          fetch(`http://localhost:8000/api/meetings/${meetingId}/transcript`).catch(() => null),
          fetch(`http://localhost:8000/api/meetings/${meetingId}/summary`).catch(() => null),
          fetch(`http://localhost:8000/api/meetings/${meetingId}/short-transcript`).catch(() => null),
          fetch(`http://localhost:8000/api/meetings/${meetingId}/decisions`).catch(() => null),
          fetch(`http://localhost:8000/api/meetings/${meetingId}/action-items`).catch(() => null),
        ]);

        if (mRes && mRes.ok) setMeeting(await mRes.json());
        if (tRes && tRes.ok) setTranscriptData(await tRes.json());
        if (sRes && sRes.ok) setSummaryData(await sRes.json());
        if (stRes && stRes.ok) setShortTranscript(await stRes.json());
        if (dRes && dRes.ok) setDecisions(await dRes.json());
        if (aRes && aRes.ok) setActionItems(await aRes.json());
      } catch (err) {
        console.error('Failed fetching meeting details:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
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

  const handleSpeakerRename = async (speakerId: string) => {
    if (!speakerNewName.trim()) return;
    try {
      const res = await fetch(`http://localhost:8000/api/meetings/${meetingId}/speakers/${speakerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmed_name: speakerNewName }),
      });
      if (res.ok) {
        const updated = await res.json();
        setTranscriptData((prev: any) => ({
          ...prev,
          speakers: prev.speakers.map((s: any) => s.id === speakerId ? updated : s)
        }));
        setEditingSpeakerId(null);
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
        { role: 'assistant', content: 'Failed to retrieve response.', citations: [] }
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const filteredSegments = (transcriptData?.segments || []).filter((seg: any) => {
    const matchesSearch = seg.text.toLowerCase().includes(transcriptSearch.toLowerCase());
    const matchesSpeaker = speakerFilter === 'ALL' || seg.speaker_id === speakerFilter;
    return matchesSearch && matchesSpeaker;
  });

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 overflow-hidden">
      {/* Main Container */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navbar */}
        <header className="h-14 border-b border-slate-800 bg-slate-950/70 px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition">
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-sm font-semibold text-white">
                {meeting?.title || 'Meeting Details'}
              </h1>
              <span className="text-[11px] text-slate-400">
                Duration: {formatTime(meeting?.duration_seconds || duration)} • Status: {meeting?.status || 'COMPLETED'}
              </span>
            </div>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            {meeting?.status || 'COMPLETED'}
          </span>
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
            { id: 'speakers', label: 'Speakers', icon: Users },
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
              <div className="flex items-center justify-between gap-4 mb-4">
                <div className="relative flex-1 max-w-md">
                  <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    value={transcriptSearch}
                    onChange={(e) => setTranscriptSearch(e.target.value)}
                    placeholder="Search words in transcript..."
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <span className="text-xs text-slate-400">
                  Click any segment to seek audio playback
                </span>
              </div>

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
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-800 text-indigo-300">
                          {seg.speaker_label || 'Speaker'}
                        </span>
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
                <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm">
                  <Clock className="h-4 w-4" />
                  <span>Chronological Meeting Explanation</span>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {shortTranscript?.narrative_text || 'Chronological explanation will appear here once processed.'}
                </p>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-white">Event Sequence</h3>
                <div className="border-l-2 border-slate-800 pl-4 space-y-6">
                  {(shortTranscript?.chronological_events || []).map((ev: any, idx: number) => (
                    <div key={idx} className="relative group cursor-pointer" onClick={() => seekTo(ev.timestamp)}>
                      <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-indigo-500 group-hover:scale-125 transition" />
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-indigo-400 hover:underline">
                          [{formatTime(ev.timestamp)}]
                        </span>
                        <span className="text-xs font-semibold text-white">{ev.speaker}</span>
                      </div>
                      <p className="text-sm text-slate-300">{ev.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: STRUCTURED SUMMARY */}
          {activeTab === 'summary' && (
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="p-6 rounded-2xl bg-slate-950/50 border border-slate-800 space-y-3">
                <h3 className="text-sm font-semibold text-indigo-400 uppercase tracking-wider">Executive Summary</h3>
                <p className="text-sm text-slate-200 leading-relaxed">
                  {summaryData?.executive_summary || 'Executive summary will appear here.'}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-5 rounded-xl bg-slate-950/40 border border-slate-800 space-y-3">
                  <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Key Discussion Points</h4>
                  <ul className="space-y-2 text-xs text-slate-300">
                    {(summaryData?.key_points || []).map((pt: string, i: number) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-emerald-400">•</span>
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-5 rounded-xl bg-slate-950/40 border border-slate-800 space-y-3">
                  <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Risks & Blockers</h4>
                  <ul className="space-y-2 text-xs text-slate-300">
                    {(summaryData?.risks || []).map((rk: string, i: number) => (
                      <li key={i} className="flex items-start gap-2">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                        <span>{rk}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: DECISIONS */}
          {activeTab === 'decisions' && (
            <div className="max-w-4xl mx-auto space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Confirmed Decisions</h3>
                <span className="text-xs text-slate-500">Linked to timestamp evidence</span>
              </div>

              <div className="space-y-3">
                {decisions.map((dec: any) => (
                  <div key={dec.id} className="p-5 rounded-xl bg-slate-950/50 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm text-white">{dec.title}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-400">
                        {dec.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">{dec.decision_text}</p>
                    {dec.evidence_quote && (
                      <div
                        onClick={() => dec.evidence_timestamp && seekTo(dec.evidence_timestamp)}
                        className="mt-2 p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-400 flex items-center justify-between cursor-pointer hover:border-slate-700 transition"
                      >
                        <span className="italic">"{dec.evidence_quote}"</span>
                        {dec.evidence_timestamp !== null && (
                          <span className="font-mono text-indigo-400 text-[11px] ml-2">
                            [{formatTime(dec.evidence_timestamp)}]
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: ACTION ITEMS */}
          {activeTab === 'actions' && (
            <div className="max-w-4xl mx-auto space-y-4">
              <h3 className="text-sm font-semibold text-white">Extracted Action Items</h3>
              <div className="space-y-3">
                {actionItems.map((item: any) => {
                  const isDone = item.status === 'COMPLETED';
                  return (
                    <div
                      key={item.id}
                      className={`p-4 rounded-xl border flex items-center justify-between gap-4 transition ${
                        isDone ? 'bg-slate-950/20 border-slate-900 opacity-60' : 'bg-slate-950/50 border-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleActionItemToggle(item.id, item.status)}
                          className={`h-5 w-5 rounded border flex items-center justify-center transition ${
                            isDone ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-700 hover:border-indigo-500'
                          }`}
                        >
                          {isDone && <Check className="h-3 w-3" />}
                        </button>
                        <div>
                          <p className={`text-sm font-medium ${isDone ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                            {item.task_description}
                          </p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                            <span>Owner: {item.owner_name || 'Unassigned'}</span>
                            {item.due_date && <span>Due: {item.due_date}</span>}
                          </div>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-400">
                        {item.priority}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 6: SPEAKERS */}
          {activeTab === 'speakers' && (
            <div className="max-w-3xl mx-auto space-y-4">
              <h3 className="text-sm font-semibold text-white">Speaker Attribution & Identity Mapping</h3>
              <div className="space-y-3">
                {(transcriptData?.speakers || []).map((spk: any) => (
                  <div key={spk.id} className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-mono text-indigo-400 block">{spk.speaker_label}</span>
                      <span className="text-sm font-semibold text-white">
                        {spk.confirmed_name || 'Anonymous Speaker'}
                      </span>
                    </div>

                    {editingSpeakerId === spk.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={speakerNewName}
                          onChange={(e) => setSpeakerNewName(e.target.value)}
                          placeholder="e.g. Dr. Sarah Chen"
                          className="px-2.5 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-white focus:outline-none focus:border-indigo-500"
                        />
                        <button
                          onClick={() => handleSpeakerRename(spk.id)}
                          className="p-1 rounded bg-indigo-600 text-white hover:bg-indigo-500"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditingSpeakerId(spk.id); setSpeakerNewName(spk.confirmed_name || ''); }}
                        className="px-3 py-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 text-xs text-slate-300 flex items-center gap-1.5 transition"
                      >
                        <Edit2 className="h-3 w-3" />
                        <span>Rename</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 7: MEETING CHAT */}
          {activeTab === 'chat' && (
            <div className="max-w-3xl mx-auto flex flex-col h-[550px] bg-slate-950/60 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-slate-800 bg-slate-950">
                <h3 className="text-xs font-semibold text-white flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-indigo-400" />
                  <span>Ask Questions About This Meeting</span>
                </h3>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-lg p-3.5 rounded-2xl text-xs leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-br-none'
                        : 'bg-slate-900 text-slate-200 border border-slate-800 rounded-bl-none'
                    }`}>
                      <p>{msg.content}</p>
                      {msg.citations && msg.citations.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-slate-800 space-y-1">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold">Evidence Citations:</span>
                          {msg.citations.map((c: any, ci: number) => (
                            <button
                              key={ci}
                              onClick={() => c.timestamp_start !== undefined && seekTo(c.timestamp_start)}
                              className="block text-[11px] text-indigo-400 hover:underline text-left"
                            >
                              [{formatTime(c.timestamp_start || 0)}] {c.quote ? `"${c.quote.slice(0, 80)}..."` : ''}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="p-3 bg-slate-900 text-slate-400 rounded-xl text-xs animate-pulse">
                      Searching meeting memory...
                    </div>
                  </div>
                )}
              </div>

              <form onSubmit={handleChatSubmit} className="p-3 border-t border-slate-800 bg-slate-950 flex gap-2">
                <input
                  type="text"
                  value={chatQuery}
                  onChange={(e) => setChatQuery(e.target.value)}
                  placeholder="Ask a question (e.g., What did we decide about the migration?)..."
                  className="flex-1 px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="submit"
                  disabled={chatLoading || !chatQuery.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition"
                >
                  Send
                </button>
              </form>
            </div>
          )}

          {/* TAB 8: VOICE ANALYSIS */}
          {activeTab === 'voice_emotion' && (
            <div className="max-w-3xl mx-auto space-y-4">
              <div className="p-6 rounded-2xl bg-slate-950/50 border border-slate-800 space-y-3">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Activity className="h-4 w-4 text-indigo-400" />
                  <span>Vocal Acoustic Emotion Analysis</span>
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Voice emotion analyzes acoustic features directly from speech audio (pitch, acoustic energy, vocal resonance). These predictions reflect acoustic expressions, not internal psychological truth.
                </p>
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-400">Predominant Acoustic State</span>
                    <span className="block text-sm font-semibold text-emerald-400">Engaged (Confidence: 88%)</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400">Mean Vocal Pitch</span>
                    <span className="block text-sm font-semibold text-slate-200">182 Hz</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
