'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Video,
  FileAudio,
  Users,
  CheckCircle2,
  ListTodo,
  Layers,
  ChevronRight,
  Sparkles,
  Clock,
  ArrowUpRight,
  Cpu,
  Tv,
  Calendar,
  AlertTriangle,
  Play
} from 'lucide-react';
import AppShell from '@/components/AppShell';

export default function Dashboard() {
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [meetings, setMeetings] = useState<any[]>([]);
  const [decisions, setDecisions] = useState<any[]>([]);
  const [actions, setActions] = useState<any[]>([]);
  const [speakers, setSpeakers] = useState<any[]>([]);
  const [healthData, setHealthData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

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

    fetch('http://localhost:8000/api/health')
      .then((res) => res.json())
      .then((data) => setHealthData(data))
      .catch((err) => console.error(err));
  }, []);

  useEffect(() => {
    if (!selectedOrgId) return;
    setLoading(true);

    Promise.all([
      fetch(`http://localhost:8000/api/meetings?organization_id=${selectedOrgId}`).then((r) => r.json()),
      fetch(`http://localhost:8000/api/organizations/${selectedOrgId}/decisions`).then((r) => r.json()).catch(() => []),
      fetch(`http://localhost:8000/api/organizations/${selectedOrgId}/action-items`).then((r) => r.json()).catch(() => []),
      fetch(`http://localhost:8000/api/organizations/${selectedOrgId}/speakers`).then((r) => r.json()).catch(() => []),
    ])
      .then(([meetingsData, decisionsData, actionsData, speakersData]) => {
        setMeetings(meetingsData.items || []);
        setDecisions(decisionsData || []);
        setActions(actionsData || []);
        setSpeakers(speakersData || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [selectedOrgId]);

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const currentOrg = organizations.find((o) => o.id === selectedOrgId) || organizations[0];
  const recentMeetings = meetings.slice(0, 5);

  return (
    <AppShell
      title="Dashboard"
      subtitle="Institutional memory, intelligence metrics, and recent meetings"
      activeOrgId={selectedOrgId}
      onOrgChange={setSelectedOrgId}
      organizations={organizations}
    >
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
        {/* Welcome Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800/60">
          <div>
            <h2 className="text-xl md:text-2xl font-semibold tracking-tight text-white">
              {currentOrg ? `${currentOrg.name} Intelligence` : 'Meeting Intelligence Workspace'}
            </h2>
            <p className="text-xs md:text-sm text-slate-400 mt-1">
              Local speech-to-text, Nemotron-3 diarization, and verifiable multi-meeting citations.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-indigo-950/60 text-indigo-300 border border-indigo-800/40">
              <Cpu className="h-3.5 w-3.5 text-indigo-400" />
              <span>Local AI Engine Active</span>
            </span>
          </div>
        </div>

        {/* Real Summary Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-[#0f172a] border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-medium">Total Meetings</span>
              <Layers className="h-4 w-4 text-indigo-400" />
            </div>
            <p className="text-2xl font-bold tracking-tight text-white">
              {loading ? '...' : meetings.length}
            </p>
            <span className="text-[11px] text-slate-400 font-mono block">In workspace archive</span>
          </div>

          <div className="p-4 rounded-xl bg-[#0f172a] border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-medium">Decisions Logged</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-bold tracking-tight text-white">
              {loading ? '...' : decisions.length}
            </p>
            <span className="text-[11px] text-slate-400 font-mono block">Extracted with citations</span>
          </div>

          <div className="p-4 rounded-xl bg-[#0f172a] border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-medium">Active Action Items</span>
              <ListTodo className="h-4 w-4 text-blue-400" />
            </div>
            <p className="text-2xl font-bold tracking-tight text-white">
              {loading ? '...' : actions.length}
            </p>
            <span className="text-[11px] text-slate-400 font-mono block">Assigned with deadlines</span>
          </div>

          <div className="p-4 rounded-xl bg-[#0f172a] border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-medium">Directory Speakers</span>
              <Users className="h-4 w-4 text-purple-400" />
            </div>
            <p className="text-2xl font-bold tracking-tight text-white">
              {loading ? '...' : speakers.length}
            </p>
            <span className="text-[11px] text-slate-400 font-mono block">Attributed participants</span>
          </div>
        </div>

        {/* Recent Meetings Table */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h3 className="font-semibold text-sm text-white">Recent Meetings</h3>
              <p className="text-xs text-slate-400">Chronological library of processed media recordings</p>
            </div>
            <Link
              href="/workspace"
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 transition"
            >
              <span>View all meetings</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="p-12 text-center rounded-xl border border-slate-800 bg-[#0f172a]">
              <p className="text-xs text-slate-400">Loading meeting library...</p>
            </div>
          ) : recentMeetings.length === 0 ? (
            <div className="p-12 text-center rounded-xl border border-dashed border-slate-800 bg-[#0f172a]/40 space-y-3">
              <Video className="h-8 w-8 text-slate-400 mx-auto" />
              <p className="text-sm font-semibold text-white">No meetings recorded yet</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Upload an audio/video recording or import a YouTube URL to generate transcripts, chronological explanations, and action items.
              </p>
            </div>
          ) : (
            <div className="border border-slate-800 rounded-xl bg-[#0f172a] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase font-mono text-[10px]">
                    <tr>
                      <th className="px-5 py-3">Meeting Title</th>
                      <th className="px-4 py-3">Source</th>
                      <th className="px-4 py-3">Duration</th>
                      <th className="px-4 py-3">Created</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-5 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {recentMeetings.map((m) => {
                      const isCompleted = m.status === 'COMPLETED';
                      const isFailed = m.status === 'FAILED';
                      const isYouTube = m.source_type === 'YOUTUBE';

                      return (
                        <tr key={m.id} className="hover:bg-slate-900/50 transition group">
                          <td className="px-5 py-3.5">
                            <Link href={`/meetings/${m.id}`} className="block">
                              <span className="font-semibold text-white group-hover:text-indigo-300 transition block truncate max-w-xs md:max-w-md">
                                {m.title}
                              </span>
                              {m.description && (
                                <span className="text-[11px] text-slate-400 truncate block max-w-xs md:max-w-md">
                                  {m.description}
                                </span>
                              )}
                            </Link>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold uppercase font-mono bg-slate-900 text-slate-300 border border-slate-800">
                              {isYouTube ? (
                                <>
                                  <Tv className="h-3 w-3 text-red-400" />
                                  <span>YouTube</span>
                                </>
                              ) : (
                                <>
                                  <Video className="h-3 w-3 text-indigo-400" />
                                  <span>Local Upload</span>
                                </>
                              )}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-slate-400 font-mono text-[11px]">
                            {m.duration_seconds ? formatDuration(m.duration_seconds) : '—'}
                          </td>
                          <td className="px-4 py-3.5 text-slate-400 font-mono text-[11px]">
                            {new Date(m.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3.5">
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
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <Link
                              href={`/meetings/${m.id}`}
                              className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-medium group-hover:translate-x-0.5 transition"
                            >
                              <span>Open</span>
                              <ChevronRight className="h-3.5 w-3.5" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Local AI Engine Architecture Overview */}
        <div className="p-6 rounded-xl bg-[#0f172a] border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h3 className="font-semibold text-sm text-white flex items-center gap-2">
                <Cpu className="h-4 w-4 text-indigo-400" />
                <span>Verified Local AI Infrastructure</span>
              </h3>
              <p className="text-xs text-slate-400">
                MeetMind processes 100% of speech recognition, diarization, and summaries on host hardware.
              </p>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
              Zero Cloud AI APIs
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800/80 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white">Speech Recognition (ASR)</span>
                <span className="text-[10px] font-mono text-indigo-400">CTranslate2</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                faster-whisper local model extracts high-fidelity transcripts with sentence-level timestamps.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800/80 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white">Speaker Diarization</span>
                <span className="text-[10px] font-mono text-indigo-400">Sortformer 99.2M</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                NVIDIA Nemotron-3-Diarization identifies speaker turns and handles overlapping speech for up to 8 speakers.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800/80 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white">Intelligence Engine</span>
                <span className="text-[10px] font-mono text-indigo-400">Local LLM / RAG</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Extracts chronological timelines, structured summaries, confirmed decisions, and action items with evidence citations.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
