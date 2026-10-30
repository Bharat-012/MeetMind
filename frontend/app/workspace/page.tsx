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
  RotateCcw,
  Square,
  Bot
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
      citations: [],
      model_name: 'ollama:llama3.2'
    }
  ]);
  const [chatQuery, setChatQuery] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [activeModelName, setActiveModelName] = useState<string>('ollama:llama3.2');
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const abortControllerRef = React.useRef<AbortController | null>(null);

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

    fetch(`http://localhost:8000/api/chat/suggested-questions?organization_id=${selectedOrgId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.questions && data.questions.length > 0) {
          setSuggestedQuestions(data.questions);
        }
      })
      .catch(() => {});

    fetch(`http://localhost:8000/api/organizations/${selectedOrgId}/action-items`)
      .then((res) => res.json())
      .then((data) => setOrgActions(data || []))
      .catch((err) => console.error(err));
  }, [selectedOrgId]);

  const submitOrgQuery = async (queryText: string) => {
    if (!queryText.trim() || !selectedOrgId || chatLoading || isStreaming) return;

    const userText = queryText.trim();
    setChatQuery('');
    setChatLoading(true);
    setIsStreaming(true);

    setChatMessages((prev) => [
      ...prev,
      { role: 'user', content: userText },
      {
        role: 'assistant',
        content: '',
        citations: [],
        model_name: activeModelName,
        isStreaming: true
      }
    ]);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const res = await fetch('http://localhost:8000/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: userText,
          organization_id: selectedOrgId,
          scope: 'ORGANIZATION',
          top_k: 8
        }),
        signal: abortController.signal
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      if (!res.body) {
        throw new Error('No stream body');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = '';
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;
            try {
              const event = JSON.parse(jsonStr);
              if (event.type === 'start') {
                if (event.model_name) setActiveModelName(event.model_name);
              } else if (event.type === 'token') {
                accumulatedText += event.content;
                setChatMessages((prev) => {
                  const updated = [...prev];
                  const lastIdx = updated.length - 1;
                  if (lastIdx >= 0 && updated[lastIdx].role === 'assistant') {
                    updated[lastIdx] = {
                      ...updated[lastIdx],
                      content: accumulatedText,
                      isStreaming: true
                    };
                  }
                  return updated;
                });
              } else if (event.type === 'end') {
                setChatMessages((prev) => {
                  const updated = [...prev];
                  const lastIdx = updated.length - 1;
                  if (lastIdx >= 0 && updated[lastIdx].role === 'assistant') {
                    updated[lastIdx] = {
                      ...updated[lastIdx],
                      content: event.answer || accumulatedText,
                      citations: event.citations || [],
                      model_name: event.model_name || activeModelName,
                      isStreaming: false
                    };
                  }
                  return updated;
                });
                if (event.model_name) setActiveModelName(event.model_name);
              }
            } catch (pErr) {}
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setChatMessages((prev) => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (lastIdx >= 0 && updated[lastIdx].role === 'assistant') {
            updated[lastIdx] = {
              ...updated[lastIdx],
              content: updated[lastIdx].content + ' [Generation stopped by user]',
              isStreaming: false
            };
          }
          return updated;
        });
      } else {
        // Fallback to non-streaming org chat
        try {
          const fbRes = await fetch(`http://localhost:8000/api/organizations/${selectedOrgId}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: userText, top_k: 8 }),
          });
          if (fbRes.ok) {
            const data = await fbRes.json();
            setChatMessages((prev) => {
              const updated = [...prev];
              const lastIdx = updated.length - 1;
              if (lastIdx >= 0 && updated[lastIdx].role === 'assistant') {
                updated[lastIdx] = {
                  role: 'assistant',
                  content: data.answer,
                  citations: data.citations || [],
                  model_name: data.model_name || 'ollama:llama3.2',
                  isStreaming: false
                };
              }
              return updated;
            });
            if (data.model_name) setActiveModelName(data.model_name);
            return;
          }
        } catch (fbErr) {}

        setChatMessages((prev) => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (lastIdx >= 0 && updated[lastIdx].role === 'assistant') {
            updated[lastIdx] = {
              role: 'assistant',
              content: 'Unable to retrieve answer across organization meetings. Verify backend status.',
              citations: [],
              isStreaming: false
            };
          }
          return updated;
        });
      }
    } finally {
      setChatLoading(false);
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const handleOrgChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitOrgQuery(chatQuery);
  };

  const handleSuggestedQuestionClick = (q: string) => {
    submitOrgQuery(q);
  };

  const handleCancelStream = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleClearChat = () => {
    setChatMessages([
      {
        role: 'assistant',
        content: 'Ask any question across all authorized meetings in your organization. Answers will synthesize evidence and provide source meeting citations.',
        citations: [],
        model_name: activeModelName
      }
    ]);
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
      title="Meetings Archive"
      subtitle="Searchable library, decisions register, and cross-meeting intelligence"
      activeOrgId={selectedOrgId}
      onOrgChange={setSelectedOrgId}
      organizations={organizations}
    >
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
        
        {/* Navigation Tabs Bar (Inspired by Reference Image Pills) */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex gap-1.5 p-1.5 bg-white rounded-2xl border border-[#E9E4F2] shadow-soft-card no-scrollbar overflow-x-auto">
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
                  className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition whitespace-nowrap ${
                    active
                      ? 'bg-gradient-to-r from-[#7135C5] via-[#8B45D6] to-[#C23DB4] text-white shadow-purple-btn'
                      : 'text-[#77738A] hover:text-[#252238] hover:bg-[#FAF8FF]'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      active ? 'bg-white/20 text-white' : 'bg-[#F3ECFE] text-[#8B45D6]'
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
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white border border-[#E9E4F2] shadow-soft-card">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-3 h-3.5 w-3.5 text-[#9D99AF]" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Search meetings by title or description..."
                  className="w-full pl-9 pr-3 py-2 bg-[#FAF8FF] border border-[#E9E4F2] rounded-xl text-xs text-[#252238] placeholder-[#9D99AF] focus:outline-none focus:border-[#8B45D6] focus:bg-white transition"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-[#77738A] font-semibold">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-[#FAF8FF] border border-[#E9E4F2] rounded-xl px-3 py-2 text-xs text-[#252238] font-medium focus:outline-none focus:border-[#8B45D6] shadow-xs"
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
              <div className="p-12 text-center rounded-3xl border border-[#E9E4F2] bg-white shadow-soft-card">
                <p className="text-xs text-[#77738A]">Loading meetings...</p>
              </div>
            ) : filteredMeetings.length === 0 ? (
              <div className="p-12 text-center rounded-3xl border border-dashed border-[#DDD5FF] bg-white shadow-soft-card space-y-3">
                <Video className="h-8 w-8 text-[#8B45D6]/60 mx-auto" />
                <p className="text-sm font-bold text-[#252238]">No matching meetings found</p>
                <p className="text-xs text-[#77738A] max-w-sm mx-auto">
                  {searchFilter || statusFilter !== 'ALL'
                    ? 'Try adjusting your search query or status filter.'
                    : 'Get started by uploading an audio/video recording or importing a YouTube URL.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredMeetings.map((m) => {
                  const isCompleted = m.status === 'COMPLETED';
                  const isFailed = m.status === 'FAILED';
                  const isYouTube = m.source_type === 'YOUTUBE';

                  return (
                    <Link
                      key={m.id}
                      href={`/meetings/${m.id}`}
                      className="p-6 rounded-3xl bg-white border border-[#E9E4F2] hover:border-[#8B45D6] shadow-soft-card hover:shadow-soft-elevated hover:translate-y-[-2px] transition-all group flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold">
                            {isYouTube ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#FDF0F4] text-[#BE123C] border border-[#FBCDD9]">
                                <Tv className="h-3 w-3" />
                                <span>YouTube</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#F3ECFE] text-[#8B45D6] border border-[#E0CFFC]">
                                <Video className="h-3 w-3" />
                                <span>Local Video</span>
                              </span>
                            )}
                          </span>

                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              isCompleted
                                ? 'bg-[#EBF9F0] text-[#16A34A] border-[#D8F3E2]'
                                : isFailed
                                ? 'bg-[#FDF0F4] text-[#BE123C] border-[#FBCDD9]'
                                : 'bg-[#FEF7EA] text-[#B45309] border-[#FDE3B7]'
                            }`}
                          >
                            {m.status}
                          </span>
                        </div>

                        <div>
                          <h3 className="font-bold text-sm text-[#252238] group-hover:text-[#8B45D6] transition line-clamp-1">
                            {m.title}
                          </h3>
                          <p className="text-xs text-[#77738A] mt-1.5 line-clamp-2 leading-relaxed">
                            {m.description || 'Spoken dialogue transcribed and attributed with local Faster-Whisper and Nemotron-3.'}
                          </p>
                        </div>
                      </div>

                      <div className="pt-4 mt-4 border-t border-[#F0ECF8] flex items-center justify-between text-[11px] text-[#77738A]">
                        <div className="flex items-center gap-2">
                          <span>{new Date(m.created_at).toLocaleDateString()}</span>
                          {m.duration_seconds && (
                            <>
                              <span>•</span>
                              <span className="font-mono">{formatDuration(m.duration_seconds)}</span>
                            </>
                          )}
                        </div>

                        <span className="text-[#8B45D6] font-semibold flex items-center gap-1 group-hover:translate-x-0.5 transition">
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
          <div className="max-w-4xl mx-auto flex flex-col h-[680px] bg-white border border-[#E9E4F2] rounded-3xl overflow-hidden shadow-soft-card">
            {/* Header */}
            <div className="px-6 py-4 border-b border-[#F0ECF8] bg-[#FAF8FF] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-[#F3ECFE] border border-[#E0CFFC] flex items-center justify-center text-[#8B45D6]">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#252238] flex items-center gap-2">
                    <span>Cross-Meeting Knowledge Assistant</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-[#D8F3E2] bg-[#EBF9F0] text-[#16A34A] flex items-center gap-1.5 font-semibold">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A] animate-pulse" />
                      <span>{activeModelName}</span>
                    </span>
                  </h3>
                  <span className="text-[11px] text-[#77738A]">
                    {meetings.length} meetings indexed in organizational memory
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleClearChat}
                className="flex items-center gap-1.5 text-xs text-[#77738A] hover:text-[#252238] px-3 py-1.5 rounded-xl border border-[#E9E4F2] hover:bg-white bg-white/60 transition"
                title="Clear cross-meeting chat history"
              >
                <RotateCcw className="h-3 w-3" />
                <span>New Chat</span>
              </button>
            </div>

            {/* Suggested Questions */}
            {suggestedQuestions.length > 0 && (
              <div className="px-6 py-3 border-b border-[#F0ECF8] bg-[#FAF8FF]/60">
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#8B45D6] flex-shrink-0 flex items-center gap-1">
                    <Sparkles className="h-2.5 w-2.5 text-[#8B45D6]" />
                    <span>Suggested:</span>
                  </span>
                  {suggestedQuestions.map((q, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSuggestedQuestionClick(q)}
                      disabled={chatLoading || isStreaming}
                      className="text-[11px] text-[#7135C5] hover:text-white bg-[#F3ECFE] hover:bg-[#8B45D6] border border-[#E0CFFC] px-3.5 py-1 rounded-full whitespace-nowrap transition flex-shrink-0 disabled:opacity-50 font-medium"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {chatMessages.map((msg, idx) => {
                const isUser = msg.role === 'user';
                return (
                  <div key={idx} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-2xl p-4.5 rounded-2xl text-xs leading-relaxed ${
                        isUser
                          ? 'bg-gradient-to-r from-[#7135C5] to-[#8B45D6] text-white rounded-br-none shadow-purple-btn'
                          : 'bg-[#FAF8FF] text-[#252238] border border-[#EAE5FF] rounded-bl-none shadow-soft-card'
                      }`}
                    >
                      {!isUser && msg.model_name && (
                        <div className="flex items-center gap-1 text-[10px] font-mono text-[#77738A] mb-2 pb-1.5 border-b border-[#E9E4F2]">
                          <Bot className="h-3 w-3 text-[#8B45D6]" />
                          <span>{msg.model_name}</span>
                        </div>
                      )}

                      <div className="whitespace-pre-wrap leading-relaxed">
                        {msg.content}
                        {msg.isStreaming && (
                          <span className="inline-block w-2 h-3.5 bg-[#8B45D6] ml-1 animate-pulse align-middle" />
                        )}
                      </div>

                      {/* Evidence Citations */}
                      {msg.citations && msg.citations.length > 0 && (
                        <div className="mt-3.5 pt-3 border-t border-[#E9E4F2] space-y-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#8B45D6] block">
                            Verifiable Meeting Citations:
                          </span>
                          <div className="space-y-1.5">
                            {msg.citations.map((c: any, ci: number) => (
                              <Link
                                key={ci}
                                href={`/meetings/${c.meeting_id}`}
                                className="block p-3 rounded-xl bg-white border border-[#E9E4F2] hover:border-[#8B45D6] shadow-xs hover:shadow-soft-card transition group"
                              >
                                <div className="flex items-center justify-between text-[11px] text-[#7135C5] font-semibold">
                                  <span className="group-hover:underline truncate max-w-sm flex items-center gap-1.5">
                                    <Video className="h-3 w-3 flex-shrink-0" />
                                    <span>{c.meeting_title || 'Meeting Record'}</span>
                                  </span>
                                  {c.timestamp_start !== undefined && c.timestamp_start !== null && (
                                    <span className="font-mono text-[#77738A] group-hover:text-[#8B45D6]">
                                      [{formatDuration(c.timestamp_start)}]
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-[#77738A] italic mt-1 line-clamp-2">
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

              {chatLoading && !isStreaming && (
                <div className="p-3.5 bg-[#FAF8FF] border border-[#EAE5FF] text-[#77738A] rounded-2xl text-xs flex items-center gap-2.5 max-w-xs animate-pulse">
                  <Loader2 className="h-4 w-4 animate-spin text-[#8B45D6]" />
                  <span>Synthesizing answers across meetings...</span>
                </div>
              )}
            </div>

            {/* Chat Input */}
            <form onSubmit={handleOrgChatSubmit} className="p-4 border-t border-[#F0ECF8] bg-[#FAF8FF]/60 flex items-center gap-2">
              <input
                type="text"
                value={chatQuery}
                onChange={(e) => setChatQuery(e.target.value)}
                disabled={isStreaming}
                placeholder="Ask any question across all authorized meetings (e.g. What did we decide about postgres migration?)..."
                className="flex-1 px-4 py-2.5 bg-white border border-[#E9E4F2] rounded-xl text-xs text-[#252238] placeholder-[#9D99AF] focus:outline-none focus:border-[#8B45D6] shadow-xs disabled:opacity-60"
              />

              {isStreaming ? (
                <button
                  type="button"
                  onClick={handleCancelStream}
                  className="bg-rose-600 hover:bg-rose-500 text-white text-xs px-4 py-2.5 rounded-xl font-medium transition flex items-center gap-1.5 shadow-sm"
                >
                  <Square className="h-3.5 w-3.5 fill-white" />
                  <span>Stop</span>
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={chatLoading || !chatQuery.trim()}
                  className="px-5 py-2.5 bg-gradient-to-r from-[#7135C5] to-[#8B45D6] hover:opacity-95 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-purple-btn transition flex items-center gap-1.5"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Ask</span>
                </button>
              )}
            </form>
          </div>
        )}

        {/* TAB 3: DECISIONS REGISTER */}
        {activeTab === 'decisions' && (
          <div className="space-y-4 max-w-4xl mx-auto">
            <div className="p-5 rounded-2xl bg-white border border-[#E9E4F2] shadow-soft-card flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#252238]">Historical Decisions Register</h3>
                <p className="text-xs text-[#77738A]">Chronological record of approved technical and product decisions</p>
              </div>
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-[#EBF9F0] text-[#16A34A] border border-[#D8F3E2]">
                {orgDecisions.length} recorded
              </span>
            </div>

            {orgDecisions.length === 0 ? (
              <div className="p-12 text-center rounded-3xl border border-dashed border-[#DDD5FF] bg-white text-xs text-[#77738A] shadow-soft-card">
                No decisions recorded in this organization yet.
              </div>
            ) : (
              <div className="space-y-3">
                {orgDecisions.map((dec) => (
                  <div key={dec.id} className="p-5 rounded-2xl bg-white border border-[#E9E4F2] shadow-soft-card space-y-2">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-0.5">
                        <span className="font-bold text-sm text-[#252238]">{dec.title}</span>
                        <div className="flex items-center gap-2 text-xs text-[#77738A]">
                          <span>Origin:</span>
                          <Link
                            href={`/meetings/${dec.meeting_id}`}
                            className="text-[#8B45D6] font-semibold hover:underline"
                          >
                            {dec.meeting_title || 'Meeting'}
                          </Link>
                          <span>•</span>
                          <span>{dec.meeting_date ? new Date(dec.meeting_date).toLocaleDateString() : 'Recent'}</span>
                        </div>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#EBF9F0] text-[#16A34A] border border-[#D8F3E2]">
                        {dec.status || 'APPROVED'}
                      </span>
                    </div>
                    <p className="text-xs text-[#77738A] leading-relaxed">{dec.decision_text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: ACTION ITEMS */}
        {activeTab === 'actions' && (
          <div className="space-y-4 max-w-4xl mx-auto">
            <div className="p-5 rounded-2xl bg-white border border-[#E9E4F2] shadow-soft-card flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#252238]">Organization Action Items</h3>
                <p className="text-xs text-[#77738A]">Comprehensive task tracking across all team meetings</p>
              </div>
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-[#F3ECFE] text-[#8B45D6] border border-[#E0CFFC]">
                {orgActions.length} recorded
              </span>
            </div>

            {orgActions.length === 0 ? (
              <div className="p-12 text-center rounded-3xl border border-dashed border-[#DDD5FF] bg-white text-xs text-[#77738A] shadow-soft-card">
                No action items recorded in this organization yet.
              </div>
            ) : (
              <div className="space-y-3">
                {orgActions.map((item) => (
                  <div
                    key={item.id}
                    className="p-5 rounded-2xl bg-white border border-[#E9E4F2] shadow-soft-card flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-[#252238] block">{item.task_description}</span>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#77738A]">
                        <span>Owner: <strong className="text-[#252238] font-semibold">{item.owner_name || 'Unassigned'}</strong></span>
                        <span>•</span>
                        <span>Meeting:</span>
                        <Link
                          href={`/meetings/${item.meeting_id}`}
                          className="text-[#8B45D6] font-semibold hover:underline"
                        >
                          {item.meeting_title || 'Meeting'}
                        </Link>
                        {item.due_date && (
                          <>
                            <span>•</span>
                            <span className="font-mono text-[#77738A]">Due: {item.due_date}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-[#F3ECFE] text-[#8B45D6] border border-[#E0CFFC] self-start sm:self-center">
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
