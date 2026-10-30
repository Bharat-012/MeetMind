'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Video,
  Users,
  CheckCircle2,
  ListTodo,
  Layers,
  ChevronRight,
  Tv,
  Calendar,
  Cpu,
  ShieldCheck,
  HardDrive
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
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800/60">
          <div>
            <h2 className="text-xl md:text-2xl font-semibold tracking-tight text-white">
              {currentOrg ? `${currentOrg.name} Overview` : 'Overview'}
            </h2>
            <p className="text-xs md:text-sm text-slate-400 mt-1">
              Verifiable meeting intelligence, speech transcription, and multi-meeting knowledge retrieval.
            </p>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-[#0e1526] border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-medium">Total Meetings</span>
              <Layers className="h-4 w-4 text-slate-400" />
            </div>
            <p className="text-2xl font-bold tracking-tight text-white">
              {loading ? '—' : meetings.length}
            </p>
            <span className="text-[11px] text-slate-400 block">Workspace archive</span>
          </div>

          <div className="p-4 rounded-xl bg-[#0e1526] border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-medium">Decisions Logged</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-400/80" />
            </div>
            <p className="text-2xl font-bold tracking-tight text-white">
              {loading ? '—' : decisions.length}
            </p>
            <span className="text-[11px] text-slate-400 block">Extracted with citations</span>
          </div>

          <div className="p-4 rounded-xl bg-[#0e1526] border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-medium">Action Items</span>
              <ListTodo className="h-4 w-4 text-indigo-400/80" />
            </div>
            <p className="text-2xl font-bold tracking-tight text-white">
              {loading ? '—' : actions.length}
            </p>
            <span className="text-[11px] text-slate-400 block">Tracked deliverables</span>
          </div>

          <div className="p-4 rounded-xl bg-[#0e1526] border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-medium">Participants</span>
              <Users className="h-4 w-4 text-slate-400" />
            </div>
            <p className="text-2xl font-bold tracking-tight text-white">
              {loading ? '—' : speakers.length}
            </p>
            <span className="text-[11px] text-slate-400 block">Directory profiles</span>
          </div>
        </div>

        {/* Recent Meetings Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm text-white">Recent Meetings</h3>
              <p className="text-xs text-slate-400">Processed recordings and intelligence artifacts</p>
            </div>
            <Link
              href="/workspace"
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 transition"
            >
              <span>View all</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="p-12 text-center rounded-xl border border-slate-800/80 bg-[#0e1526]">
              <p className="text-xs text-slate-400">Loading meeting library...</p>
            </div>
          ) : recentMeetings.length === 0 ? (
            <div className="p-12 text-center rounded-xl border border-dashed border-slate-800 bg-[#0e1526]/50 space-y-3">
              <Video className="h-8 w-8 text-slate-500 mx-auto" />
              <p className="text-sm font-medium text-white">No meetings recorded yet</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Upload a video or audio recording to generate transcripts, chronological explanations, and action items.
              </p>
            </div>
          ) : (
            <div className="border border-slate-800/80 rounded-xl bg-[#0e1526] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/60 border-b border-slate-800/80 text-slate-400 font-medium text-[11px]">
                    <tr>
                      <th className="px-5 py-3">Title</th>
                      <th className="px-4 py-3">Source</th>
                      <th className="px-4 py-3">Duration</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-5 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {recentMeetings.map((m) => {
                      const isCompleted = m.status === 'COMPLETED';
                      const isFailed = m.status === 'FAILED';
                      const isYouTube = m.source_type === 'YOUTUBE';

                      return (
                        <tr key={m.id} className="hover:bg-slate-900/40 transition group">
                          <td className="px-5 py-3.5">
                            <Link href={`/meetings/${m.id}`} className="block">
                              <span className="font-medium text-white group-hover:text-indigo-300 transition block truncate max-w-xs md:max-w-md">
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
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] bg-slate-900/80 text-slate-300 border border-slate-800">
                              {isYouTube ? (
                                <>
                                  <Tv className="h-3 w-3 text-red-400" />
                                  <span>YouTube</span>
                                </>
                              ) : (
                                <>
                                  <Video className="h-3 w-3 text-indigo-400" />
                                  <span>Upload</span>
                                </>
                              )}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-slate-400 font-mono text-[11px]">
                            {m.duration_seconds ? formatDuration(m.duration_seconds) : '—'}
                          </td>
                          <td className="px-4 py-3.5 text-slate-400 text-[11px]">
                            {new Date(m.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3.5">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                                isCompleted
                                  ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/30'
                                  : isFailed
                                  ? 'bg-rose-950/40 text-rose-400 border-rose-800/30'
                                  : 'bg-indigo-950/40 text-indigo-300 border-indigo-800/30'
                              }`}
                            >
                              {m.status}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <Link
                              href={`/meetings/${m.id}`}
                              className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-medium transition"
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

        {/* Clean System Telemetry Strip */}
        <div className="p-4 rounded-xl bg-[#0e1526] border border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-4 w-4 text-emerald-400 flex-shrink-0" />
            <div>
              <span className="text-white font-medium">Local-First Architecture: </span>
              <span>All speech-to-text, speaker diarization, and vector retrieval run strictly on host hardware.</span>
            </div>
          </div>
          <div className="flex items-center gap-3 font-mono text-[11px] text-slate-400">
            <span>Faster-Whisper</span>
            <span>•</span>
            <span>Nemotron-3</span>
            <span>•</span>
            <span>Local RAG</span>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
