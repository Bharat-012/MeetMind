'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Layers,
  Search,
  CheckCircle2,
  ListTodo,
  MessageSquare,
  Video,
  ChevronRight,
  Sparkles,
  Building,
  Filter,
  Calendar,
  Clock,
  Users
} from 'lucide-react';
import IngestModal from '@/components/IngestModal';

export default function WorkspacePage() {
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [meetings, setMeetings] = useState<any[]>([]);
  const [orgDecisions, setOrgDecisions] = useState<any[]>([]);
  const [orgActions, setOrgActions] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'meetings' | 'chat' | 'decisions' | 'actions'>('meetings');
  const [isModalOpen, setIsModalOpen] = useState(false);

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

    fetch(`http://localhost:8000/api/meetings?organization_id=${selectedOrgId}`)
      .then((res) => res.json())
      .then((data) => setMeetings(data.items || []))
      .catch((err) => console.error(err));

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
      }
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Failed to retrieve cross-meeting intelligence.', citations: [] }
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-800 bg-slate-950/70 p-4 flex flex-col justify-between">
        <div>
          <Link href="/" className="flex items-center gap-3 px-2 py-3 mb-6">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/30">
              M
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight text-white">MeetMind</span>
              <span className="block text-xs text-indigo-400 font-medium">Organizational Memory</span>
            </div>
          </Link>

          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('meetings')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                activeTab === 'meetings' ? 'bg-indigo-600/20 text-indigo-400' : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Layers className="h-4 w-4" />
              <span>Meeting Library</span>
            </button>

            <button
              onClick={() => setActiveTab('chat')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                activeTab === 'chat' ? 'bg-indigo-600/20 text-indigo-400' : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <MessageSquare className="h-4 w-4" />
              <span>Cross-Meeting Chat</span>
            </button>

            <button
              onClick={() => setActiveTab('decisions')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                activeTab === 'decisions' ? 'bg-indigo-600/20 text-indigo-400' : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Decisions Timeline</span>
            </button>

            <button
              onClick={() => setActiveTab('actions')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                activeTab === 'actions' ? 'bg-indigo-600/20 text-indigo-400' : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <ListTodo className="h-4 w-4" />
              <span>All Action Items</span>
            </button>

            <Link
              href="/speakers"
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition text-slate-400 hover:text-white hover:bg-slate-900"
            >
              <Users className="h-4 w-4 text-indigo-400" />
              <span>Speaker Directory</span>
            </Link>
          </nav>
        </div>

        {/* Organization Switcher */}
        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-2">
          <div className="flex items-center gap-2 text-slate-400">
            <Building className="h-3.5 w-3.5" />
            <span>Active Organization</span>
          </div>
          <select
            value={selectedOrgId}
            onChange={(e) => setSelectedOrgId(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-indigo-500"
          >
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>{org.name}</option>
            ))}
          </select>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 border-b border-slate-800 px-8 flex items-center justify-between bg-slate-950/40 backdrop-blur">
          <h1 className="text-lg font-semibold text-white">
            {activeTab === 'meetings' && 'Meeting Archive'}
            {activeTab === 'chat' && 'Cross-Meeting Organizational Chat'}
            {activeTab === 'decisions' && 'Historical Decisions Register'}
            {activeTab === 'actions' && 'Organization Action Items'}
          </h1>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium shadow-md shadow-indigo-600/30 transition"
          >
            <Video className="h-4 w-4" />
            <span>Ingest Meeting</span>
          </button>
        </header>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-8">
          {/* TAB 1: MEETINGS LIST */}
          {activeTab === 'meetings' && (
            <div className="space-y-4 max-w-5xl">
              {meetings.length === 0 ? (
                <div className="p-12 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-950/30">
                  <Video className="h-8 w-8 text-slate-500 mx-auto mb-3" />
                  <p className="text-sm text-slate-300 font-medium">No meetings found in this organization.</p>
                  <p className="text-xs text-slate-500 mt-1">Upload an audio/video recording or import a URL to start.</p>
                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition"
                  >
                    Ingest First Meeting
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {meetings.map((m) => (
                    <Link
                      key={m.id}
                      href={`/meetings/${m.id}`}
                      className="p-5 rounded-xl bg-slate-950/50 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-900/60 transition group flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-500">
                            {m.source_type}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-400">
                            {m.status}
                          </span>
                        </div>
                        <h3 className="font-semibold text-sm text-white group-hover:text-indigo-300 transition">
                          {m.title}
                        </h3>
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                          {m.description || 'AI-processed transcript, chronological explanation, decisions, and action items.'}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-900 text-xs text-slate-500">
                        <span>{new Date(m.created_at).toLocaleDateString()}</span>
                        <span className="flex items-center gap-1 text-indigo-400 font-medium group-hover:translate-x-1 transition">
                          <span>Open</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CROSS-MEETING CHAT */}
          {activeTab === 'chat' && (
            <div className="max-w-4xl flex flex-col h-[600px] bg-slate-950/60 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
                <span className="text-xs font-semibold text-white flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-indigo-400" />
                  <span>Synthesizing Answers Across All Organization Meetings</span>
                </span>
                <span className="text-[11px] text-slate-500">
                  {meetings.length} Meetings in Scope
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xl p-4 rounded-2xl text-xs leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-br-none'
                        : 'bg-slate-900 text-slate-200 border border-slate-800 rounded-bl-none'
                    }`}>
                      <p>{msg.content}</p>
                      {msg.citations && msg.citations.length > 0 && (
                        <div className="mt-3 pt-2.5 border-t border-slate-800 space-y-1.5">
                          <span className="text-[10px] text-slate-400 font-semibold uppercase">Source Meeting Evidence:</span>
                          {msg.citations.map((c: any, ci: number) => (
                            <Link
                              key={ci}
                              href={`/meetings/${c.meeting_id}`}
                              className="block p-2 rounded bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition"
                            >
                              <div className="flex items-center justify-between text-[11px] text-indigo-400 font-medium">
                                <span>{c.meeting_title || 'Meeting'}</span>
                                <span className="font-mono text-slate-500">
                                  [{Math.floor((c.timestamp_start || 0) / 60)}:{((c.timestamp_start || 0) % 60).toString().padStart(2, '0')}]
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-300 italic mt-0.5">"{c.quote}"</p>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="p-3 bg-slate-900 text-slate-400 rounded-xl text-xs animate-pulse max-w-xs">
                    Searching across organization meetings...
                  </div>
                )}
              </div>

              <form onSubmit={handleOrgChatSubmit} className="p-3 border-t border-slate-800 bg-slate-950 flex gap-2">
                <input
                  type="text"
                  value={chatQuery}
                  onChange={(e) => setChatQuery(e.target.value)}
                  placeholder="Ask across all meetings (e.g., What did we decide about cloud migration?)..."
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

          {/* TAB 3: DECISIONS TIMELINE */}
          {activeTab === 'decisions' && (
            <div className="space-y-4 max-w-4xl">
              {orgDecisions.map((dec) => (
                <div key={dec.id} className="p-5 rounded-xl bg-slate-950/50 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-sm text-white">{dec.title}</span>
                      <span className="block text-xs text-slate-500">
                        Origin: {dec.meeting_title} ({dec.meeting_date ? new Date(dec.meeting_date).toLocaleDateString() : 'Recent'})
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-400">
                      {dec.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">{dec.decision_text}</p>
                </div>
              ))}
            </div>
          )}

          {/* TAB 4: ACTION ITEMS */}
          {activeTab === 'actions' && (
            <div className="space-y-3 max-w-4xl">
              {orgActions.map((item) => (
                <div key={item.id} className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-slate-200">{item.task_description}</span>
                    <span className="block text-xs text-slate-500 mt-1">
                      Meeting: {item.meeting_title} • Owner: {item.owner_name || 'Unassigned'}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/20 text-indigo-300">
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Ingestion Modal */}
      <IngestModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        organizationId={selectedOrgId}
        workspaceId={organizations[0]?.workspaces?.[0]?.id || selectedOrgId}
        onSuccess={() => {
          // Refresh meeting list
          fetch(`http://localhost:8000/api/meetings?organization_id=${selectedOrgId}`)
            .then((res) => res.json())
            .then((data) => setMeetings(data.items || []));
        }}
      />
    </div>
  );
}

