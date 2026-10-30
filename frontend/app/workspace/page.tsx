'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Layers,
  Search,
  CheckCircle2,
  ListTodo,
  MessageSquare,
  Video,
  ChevronRight,
  Sparkles,
  Calendar,
  Clock,
  Tv,
  ExternalLink,
  Send,
  Loader2,
  Filter,
  UserCheck,
  Building
} from 'lucide-react';
import AppShell from '@/components/AppShell';

export default function WorkspacePage() {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('');
  const [meetings, setMeetings] = useState<any[]>([]);
  const [orgDecisions, setOrgDecisions] = useState<any[]>([]);
  const [orgActions, setOrgActions] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'meetings' | 'chat' | 'decisions' | 'actions'>('meetings');
  const [loading, setLoading] = useState<boolean>(true);

  // Filters for meetings list
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Cross-meeting chat state
  const [chatMessages, setChatMessages] = useState<any[]>([
    {
      role: 'assistant',
      content: 'Ask any question across all authorized meetings in your organization. Answers will synthesize evidence and provide source meeting citations.',
      citations: []
    }
  ]);
  const [chatQuery, setChatQuery] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

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
    setLoading(true);

    fetch(`http://localhost:8000/api/organizations/${selectedOrgId}/workspaces`)
      .then((res) => res.json())
      .then((wsList) => {
        if (wsList && wsList.length > 0) {
          setSelectedWorkspaceId(wsList[0].id);
        }
      })
      .catch((err) => console.error(err));

    fetch(`http://localhost:8000/api/meetings?organization_id=${selectedOrgId}`)
      .then((res) => res.json())
      .then((data) => {
        setMeetings(data.items || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });

    fetch(`http://localhost:8000/api/organizations/${selectedOrgId}/decisions`)
      .then((res) => res.json())
      .then((data) => setOrgDecisions(data || []))
      .catch((err) => console.error(err));

    fetch(`http://localhost:8000/api/organizations/${selectedOrgId}/action-items`)
      .then((res) => res.json())
      .then((data) => setOrgActions(data || []))
      .catch((err) => console.error(err));
  }, [selectedOrgId]);

  const handleOrgChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatQuery.trim() || !selectedOrgId) return;

    const userText = chatQuery;
    setChatQuery('');
    setChatMessages((prev) => [...prev, { role: 'user', content: userText }]);
    setChatLoading(true);

    try {
      const res = await fetch(`http://localhost:8000/api/organizations/${selectedOrgId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userText, top_k: 8 }),
      });

      if (res.ok) {
        const data = await res.json();
        setChatMessages((prev) => [
          ...prev,
          { role: 'assistant', content: data.answer, citations: data.citations || [] }
        ]);
      } else {
        throw new Error('Chat request failed');
      }
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Unable to retrieve answer across organization meetings. Verify backend status.',
          citations: []
        }
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const filteredMeetings = meetings.filter((m) => {
    const matchesSearch =
      !searchFilter ||
      m.title?.toLowerCase().includes(searchFilter.toLowerCase()) ||
      m.description?.toLowerCase().includes(searchFilter.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || m.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <AppShell
      title="Meetings Library & Organizational Memory"
      subtitle="Searchable archive, historical decision register, and cross-meeting intelligence"
      activeOrgId={selectedOrgId}
      onOrgChange={setSelectedOrgId}
      organizations={organizations}
    >
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
        {/* Navigation Tabs Bar */}
        <div className="border-b border-slate-800 pb-3 flex items-center justify-between flex-wrap gap-3">
          <div className="flex gap-1.5 p-1 bg-slate-900/80 rounded-xl border border-slate-800">
            {[
              { id: 'meetings', label: 'All Meetings', icon: Layers, badge: meetings.length },
              { id: 'chat', label: 'Cross-Meeting Chat', icon: MessageSquare },
              { id: 'decisions', label: 'Decisions Register', icon: CheckCircle2, badge: orgDecisions.length },
              { id: 'actions', label: 'Action Items', icon: ListTodo, badge: orgActions.length },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition ${
                    active
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-semibold ${
                      active ? 'bg-indigo-800 text-indigo-100' : 'bg-slate-800 text-slate-300'
                    }`}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* TAB 1: ALL MEETINGS */}
        {activeTab === 'meetings' && (
          <div className="space-y-4">
            {/* Search and Filters Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Search meetings by title or description..."
                  className="w-full pl-9 pr-3 py-2 bg-[#0f172a] border border-slate-800 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-[#0f172a] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="TRANSCRIBING">Transcribing</option>
                  <option value="DIARIZING">Diarizing</option>
                  <option value="GENERATING_SUMMARY">Generating Summary</option>
                  <option value="FAILED">Failed</option>
                </select>
              </div>
            </div>

            {loading ? (
              <div className="p-12 text-center rounded-xl border border-slate-800 bg-[#0f172a]">
                <p className="text-xs text-slate-400">Loading meetings...</p>
              </div>
            ) : filteredMeetings.length === 0 ? (
              <div className="p-12 text-center rounded-xl border border-dashed border-slate-800 bg-[#0f172a]/40 space-y-3">
                <Video className="h-8 w-8 text-slate-400 mx-auto" />
                <p className="text-sm font-semibold text-white">No matching meetings found</p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  {searchFilter || statusFilter !== 'ALL'
                    ? 'Try adjusting your search query or status filter.'
                    : 'Get started by uploading an audio/video recording or importing a YouTube URL.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredMeetings.map((m) => {
                  const isCompleted = m.status === 'COMPLETED';
                  const isFailed = m.status === 'FAILED';
                  const isYouTube = m.source_type === 'YOUTUBE';

                  return (
                    <Link
                      key={m.id}
                      href={`/meetings/${m.id}`}
                      className="p-5 rounded-xl bg-[#0f172a] border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-900/60 transition group flex flex-col justify-between"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold uppercase font-mono bg-slate-900 text-slate-300 border border-slate-800">
                            {isYouTube ? (
                              <>
                                <Tv className="h-3 w-3 text-red-400" />
                                <span>YouTube</span>
                              </>
                            ) : (
                              <>
                                <Video className="h-3 w-3 text-indigo-400" />
                                <span>Local Video</span>
                              </>
                            )}
                          </span>

                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border ${
                              isCompleted
                                ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/40'
                                : isFailed
                                ? 'bg-rose-950/60 text-rose-400 border-rose-800/40'
                                : 'bg-indigo-950/60 text-indigo-300 border-indigo-800/40 animate-pulse'
                            }`}
                          >
                            {m.status}
                          </span>
                        </div>

                        <div>
                          <h3 className="font-semibold text-sm text-white group-hover:text-indigo-300 transition line-clamp-1">
                            {m.title}
                          </h3>
                          <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                            {m.description || 'Spoken dialogue transcribed and attributed with local Faster-Whisper and Nemotron-3.'}
                          </p>
                        </div>
                      </div>

                      <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                        <div className="flex items-center gap-2">
                          <span>{new Date(m.created_at).toLocaleDateString()}</span>
                          {m.duration_seconds && (
                            <>
                              <span>•</span>
                              <span>{formatDuration(m.duration_seconds)}</span>
                            </>
                          )}
                        </div>

                        <span className="text-indigo-400 font-sans font-medium flex items-center gap-1 group-hover:translate-x-0.5 transition">
                          <span>Open</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: CROSS-MEETING CHAT */}
        {activeTab === 'chat' && (
          <div className="max-w-4xl mx-auto flex flex-col h-[650px] bg-[#0f172a] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <Sparkles className="h-4 w-4 text-indigo-400" />
                <span>Multi-Meeting Synthesizer</span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                {meetings.length} meetings in organizational scope
              </span>
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {chatMessages.map((msg, idx) => {
                const isUser = msg.role === 'user';
                return (
                  <div key={idx} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-2xl p-4 rounded-2xl text-xs leading-relaxed ${
                        isUser
                          ? 'bg-indigo-600 text-white rounded-br-none'
                          : 'bg-slate-900 text-slate-200 border border-slate-800 rounded-bl-none'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>

                      {/* Evidence Citations */}
                      {msg.citations && msg.citations.length > 0 && (
                        <div className="mt-3.5 pt-3 border-t border-slate-800/80 space-y-2">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block font-semibold">
                            Verifiable Meeting Citations:
                          </span>
                          <div className="space-y-1.5">
                            {msg.citations.map((c: any, ci: number) => (
                              <Link
                                key={ci}
                                href={`/meetings/${c.meeting_id}`}
                                className="block p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 hover:border-indigo-500/40 hover:bg-slate-900/40 transition group"
                              >
                                <div className="flex items-center justify-between text-[11px] text-indigo-400 font-medium">
                                  <span className="group-hover:underline truncate max-w-sm">
                                    {c.meeting_title || 'Meeting'}
                                  </span>
                                  <span className="font-mono text-slate-400">
                                    [{formatDuration(c.timestamp_start)}]
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-300 italic mt-1 line-clamp-2">
                                  "{c.quote}"
                                </p>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {chatLoading && (
                <div className="p-3.5 bg-slate-900 border border-slate-800 text-slate-400 rounded-xl text-xs flex items-center gap-2.5 max-w-xs animate-pulse">
                  <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
                  <span>Synthesizing answers across meetings...</span>
                </div>
              )}
            </div>

            {/* Chat Input */}
            <form onSubmit={handleOrgChatSubmit} className="p-3.5 border-t border-slate-800 bg-slate-900/60 flex gap-2">
              <input
                type="text"
                value={chatQuery}
                onChange={(e) => setChatQuery(e.target.value)}
                placeholder="Ask any question across all authorized meetings (e.g., What did we decide about cloud migration?)..."
                className="flex-1 px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={chatLoading || !chatQuery.trim()}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Ask</span>
              </button>
            </form>
          </div>
        )}

        {/* TAB 3: DECISIONS REGISTER */}
        {activeTab === 'decisions' && (
          <div className="space-y-3 max-w-4xl mx-auto">
            <div className="p-4 rounded-xl bg-[#0f172a] border border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">Historical Decisions Register</h3>
                <p className="text-xs text-slate-400">Chronological record of approved technical and product decisions</p>
              </div>
              <span className="text-xs font-mono px-2.5 py-1 rounded bg-slate-900 text-slate-300 border border-slate-800">
                {orgDecisions.length} recorded
              </span>
            </div>

            {orgDecisions.length === 0 ? (
              <div className="p-12 text-center rounded-xl border border-dashed border-slate-800 bg-[#0f172a]/40 text-xs text-slate-400">
                No decisions recorded in this organization yet.
              </div>
            ) : (
              <div className="space-y-2.5">
                {orgDecisions.map((dec) => (
                  <div key={dec.id} className="p-5 rounded-xl bg-[#0f172a] border border-slate-800 space-y-2">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-0.5">
                        <span className="font-semibold text-sm text-white">{dec.title}</span>
                        <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                          <span>Origin:</span>
                          <Link
                            href={`/meetings/${dec.meeting_id}`}
                            className="text-indigo-400 hover:underline font-sans"
                          >
                            {dec.meeting_title || 'Meeting'}
                          </Link>
                          <span>•</span>
                          <span>{dec.meeting_date ? new Date(dec.meeting_date).toLocaleDateString() : 'Recent'}</span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
                        {dec.status || 'APPROVED'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed font-sans">{dec.decision_text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: ACTION ITEMS */}
        {activeTab === 'actions' && (
          <div className="space-y-3 max-w-4xl mx-auto">
            <div className="p-4 rounded-xl bg-[#0f172a] border border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">Organization Action Items</h3>
                <p className="text-xs text-slate-400">Comprehensive task tracking across all team meetings</p>
              </div>
              <span className="text-xs font-mono px-2.5 py-1 rounded bg-slate-900 text-slate-300 border border-slate-800">
                {orgActions.length} recorded
              </span>
            </div>

            {orgActions.length === 0 ? (
              <div className="p-12 text-center rounded-xl border border-dashed border-slate-800 bg-[#0f172a]/40 text-xs text-slate-400">
                No action items recorded in this organization yet.
              </div>
            ) : (
              <div className="space-y-2.5">
                {orgActions.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl bg-[#0f172a] border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <span className="text-xs font-semibold text-white block">{item.task_description}</span>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                        <span className="text-slate-300">Owner: {item.owner_name || 'Unassigned'}</span>
                        <span>•</span>
                        <span>Meeting:</span>
                        <Link
                          href={`/meetings/${item.meeting_id}`}
                          className="text-indigo-400 hover:underline"
                        >
                          {item.meeting_title || 'Meeting'}
                        </Link>
                        {item.due_date && (
                          <>
                            <span>•</span>
                            <span className="font-mono text-slate-400">Due: {item.due_date}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-indigo-950/60 text-indigo-300 border border-indigo-800/40 self-start sm:self-center">
                      {item.status || 'PENDING'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
