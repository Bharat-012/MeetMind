'use client';

import React, { useState, useEffect } from 'react';
import {
  Video,
  FileAudio,
  Sparkles,
  Users,
  Search,
  CheckCircle2,
  Clock,
  Layers,
  ChevronRight,
  ShieldCheck,
  MessageSquare
} from 'lucide-react';

export default function Dashboard() {
  const [backendHealth, setBackendHealth] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetch('http://localhost:8000/api/health')
      .then((res) => res.json())
      .then((data) => {
        setBackendHealth(data);
        setLoading(false);
      })
      .catch((err) => {
        setBackendHealth({ status: 'offline', error: err.message });
        setLoading(false);
      });
  }, []);

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 overflow-hidden">
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-slate-800 bg-slate-950/70 p-4 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 px-2 py-3 mb-6">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/30">
              M
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight text-white">MeetMind</span>
              <span className="block text-xs text-indigo-400 font-medium">Enterprise Intelligence</span>
            </div>
          </div>

          <nav className="space-y-1">
            <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-indigo-600/20 text-indigo-400 font-medium text-sm">
              <Layers className="h-4 w-4" />
              <span>Workspace Library</span>
            </a>
            <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-900 font-medium text-sm transition">
              <Search className="h-4 w-4" />
              <span>Global Knowledge</span>
            </a>
            <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-900 font-medium text-sm transition">
              <CheckCircle2 className="h-4 w-4" />
              <span>Action Items</span>
            </a>
            <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-900 font-medium text-sm transition">
              <MessageSquare className="h-4 w-4" />
              <span>Org Chat</span>
            </a>
          </nav>
        </div>

        {/* Backend Connectivity Status Pill */}
        <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-slate-400">Backend API</span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
              backendHealth?.status === 'ok' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
            }`}>
              {loading ? 'Checking...' : backendHealth?.status === 'ok' ? 'Online' : 'Standby'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500">FastAPI • SQLite / Postgres</p>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        <header className="h-16 border-b border-slate-800 px-8 flex items-center justify-between bg-slate-950/40 backdrop-blur">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold text-white">Engineering Workspace</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
              Acme Corp
            </span>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium shadow-md shadow-indigo-600/30 transition">
            <Video className="h-4 w-4" />
            <span>Ingest Meeting</span>
          </button>
        </header>

        <div className="p-8 space-y-8 max-w-7xl">
          {/* Welcome & Overview Card */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-950/60 via-slate-900 to-slate-900 border border-indigo-900/40 p-8 shadow-xl">
            <div className="relative z-10 max-w-2xl space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-medium">
                <Sparkles className="h-3.5 w-3.5" />
                <span>AI Meeting Intelligence & Organizational Memory</span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-white">
                Turn Every Conversation Into Searchable Institutional Knowledge
              </h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                MeetMind processes meeting recordings and videos into timestamped, speaker-attributed transcripts, chronological explanations, confirmed decisions, and verifiable action items.
              </p>
            </div>
          </div>

          {/* Three Deliverables Showcase */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-3 hover:border-slate-700 transition">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <FileAudio className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-white">1. Full Timestamped Transcript</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Complete spoken dialogue with sentence-level timestamps, speaker turns, confidence metrics, and synchronized seeking.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-3 hover:border-slate-700 transition">
              <div className="h-10 w-10 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                <Clock className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-white">2. Chronological Explanation</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Narrative sequential explanation of who introduced each topic, arguments raised, disagreements, and final resolutions.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-3 hover:border-slate-700 transition">
              <div className="h-10 w-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-white">3. Structured Summary & Actions</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Executive summary, explicit decisions with evidence quotes, and assigned action items with deadlines and tracking.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

