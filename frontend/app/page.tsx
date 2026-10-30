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
  Plus,
  Sparkles,
  ArrowUpRight,
  Trash2
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
      fetch(`http://localhost:8000/api/organizations/${selectedOrgId}/action-items`).then((r) => r.json()).catch(() => []),
    ])
      .then(([meetingsData, actionsData]) => {
        setMeetings(meetingsData.items || []);
        setActions(actionsData || []);
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

  const handleDeleteMeeting = async (meetingId: string, title?: string) => {
    if (!confirm(`Are you sure you want to delete "${title || 'this meeting'}"? This will permanently remove its audio/video file, speech transcript, summary, and action items.`)) {
      return;
    }
    try {
      const res = await fetch(`http://localhost:8000/api/meetings/${meetingId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setMeetings((prev) => prev.filter((m) => m.id !== meetingId));
      }
    } catch (err) {
      console.error('Failed to delete meeting:', err);
    }
  };

  const currentOrg = organizations.find((o) => o.id === selectedOrgId) || organizations[0];
  const recentMeetings = meetings.slice(0, 5);

  return (
    <AppShell
      title="Overview"
      subtitle="Institutional memory, intelligence metrics, and recent meetings"
      activeOrgId={selectedOrgId}
      onOrgChange={setSelectedOrgId}
      organizations={organizations}
    >
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-7">
        
        {/* Prominent Purple-to-Magenta Hero Banner (Inspired by Reference Image) */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#7135C5] via-[#8B45D6] to-[#C23DB4] p-7 md:p-9 text-white shadow-soft-elevated">
          {/* Subtle Decorative Background Rings */}
          <div className="absolute -right-12 -top-12 h-64 w-64 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <div className="absolute right-32 -bottom-16 h-56 w-56 rounded-full bg-white/10 blur-xl pointer-events-none" />
          
          <div className="relative z-10 max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider backdrop-blur-md">
              <Sparkles className="h-3 w-3 text-white" />
              <span>Institutional Memory • Local Engine</span>
            </div>
            
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight leading-tight">
              Transform discussions into searchable intelligence
            </h2>
            
            <p className="text-xs md:text-sm text-white/90 leading-relaxed max-w-xl">
              Import local audio/video recordings or YouTube streams. MeetMind automatically generates speech-to-text transcripts, speaker identification, structured executive summaries, and action items.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <Link
                href="/workspace"
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-xs font-bold text-[#7135C5] shadow-md hover:bg-white/95 hover:scale-[1.02] active:scale-[0.98] transition"
              >
                <span>Browse Meetings Archive</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>

              <span className="text-[11px] font-medium text-white/80">
                100% On-Device Processing • Zero Cloud APIs
              </span>
            </div>
          </div>
        </div>

        {/* 2 Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Card 1: Total Meetings */}
          <div className="p-5 rounded-2xl bg-white border border-[#E9E4F2] shadow-soft-card space-y-3 hover:translate-y-[-2px] transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#77738A]">Total Meetings</span>
              <div className="h-8 w-8 rounded-xl bg-[#F3ECFE] border border-[#E0CFFC] flex items-center justify-center text-[#8B45D6]">
                <Layers className="h-4 w-4" />
              </div>
            </div>
            <div>
              <p className="text-2xl md:text-3xl font-extrabold text-[#252238] tracking-tight">
                {loading ? '—' : meetings.length}
              </p>
              <div className="w-full bg-[#FAF8FF] h-1.5 rounded-full mt-2.5 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[#7135C5] to-[#8B45D6] rounded-full" style={{ width: '100%' }} />
              </div>
            </div>
            <span className="text-[11px] font-medium text-[#77738A] block">
              In workspace archive
            </span>
          </div>

          {/* Card 2: Action Items */}
          <div className="p-5 rounded-2xl bg-white border border-[#E9E4F2] shadow-soft-card space-y-3 hover:translate-y-[-2px] transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#77738A]">Action Items</span>
              <div className="h-8 w-8 rounded-xl bg-[#EBF9F0] border border-[#D8F3E2] flex items-center justify-center text-[#16A34A]">
                <ListTodo className="h-4 w-4" />
              </div>
            </div>
            <div>
              <p className="text-2xl md:text-3xl font-extrabold text-[#252238] tracking-tight">
                {loading ? '—' : actions.length}
              </p>
              <div className="w-full bg-[#FAF8FF] h-1.5 rounded-full mt-2.5 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[#16A34A] to-emerald-400 rounded-full" style={{ width: actions.length > 0 ? '75%' : '0%' }} />
              </div>
            </div>
            <span className="text-[11px] font-medium text-[#77738A] block">
              Tracked deliverables
            </span>
          </div>
        </div>

        {/* Recent Meetings Table Surface (Pure White with Soft Lavender Border) */}
        <div className="p-6 rounded-3xl bg-white border border-[#E9E4F2] shadow-soft-card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base text-[#252238]">Recent Meetings</h3>
              <p className="text-xs text-[#77738A]">Processed recordings, speech transcripts, and summaries</p>
            </div>
            <Link
              href="/workspace"
              className="text-xs text-[#8B45D6] hover:text-[#7135C5] font-semibold flex items-center gap-1 transition"
            >
              <span>View all</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="p-12 text-center rounded-2xl bg-[#FAF8FF] border border-[#F0ECF8]">
              <p className="text-xs text-[#77738A]">Loading meeting library...</p>
            </div>
          ) : recentMeetings.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-dashed border-[#DDD5FF] bg-[#FAF8FF] space-y-3">
              <Video className="h-8 w-8 text-[#8B45D6]/60 mx-auto" />
              <p className="text-sm font-semibold text-[#252238]">No meetings recorded yet</p>
              <p className="text-xs text-[#77738A] max-w-sm mx-auto">
                Upload a video/audio recording or import a YouTube URL to automatically generate transcripts, summaries, and action items.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-[#F0ECF8]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF8FF] border-b border-[#F0ECF8] text-[#77738A] font-semibold text-[11px]">
                  <tr>
                    <th className="px-5 py-3.5">Title</th>
                    <th className="px-4 py-3.5">Source</th>
                    <th className="px-4 py-3.5">Duration</th>
                    <th className="px-4 py-3.5">Date</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0ECF8]">
                  {recentMeetings.map((m) => {
                    const isCompleted = m.status === 'COMPLETED';
                    const isFailed = m.status === 'FAILED';
                    const isYouTube = m.source_type === 'YOUTUBE';

                    return (
                      <tr key={m.id} className="hover:bg-[#FAF8FF] transition group">
                        <td className="px-5 py-4">
                          <Link href={`/meetings/${m.id}`} className="block">
                            <span className="font-semibold text-sm text-[#252238] group-hover:text-[#8B45D6] transition block truncate max-w-xs md:max-w-md">
                              {m.title}
                            </span>
                            {m.description && (
                              <span className="text-[11px] text-[#77738A] truncate block max-w-xs md:max-w-md mt-0.5">
                                {m.description}
                              </span>
                            )}
                          </Link>
                        </td>
                        <td className="px-4 py-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold">
                            {isYouTube ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#FDF0F4] text-[#BE123C] border border-[#FBCDD9]">
                                <Tv className="h-3 w-3" />
                                <span>YouTube</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#F3ECFE] text-[#8B45D6] border border-[#E0CFFC]">
                                <Video className="h-3 w-3" />
                                <span>Upload</span>
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-[#77738A] font-mono text-[11px]">
                          {m.duration_seconds ? formatDuration(m.duration_seconds) : '—'}
                        </td>
                        <td className="px-4 py-4 text-[#77738A] text-[11px]">
                          {new Date(m.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-4">
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
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="inline-flex items-center gap-3">
                            <Link
                              href={`/meetings/${m.id}`}
                              className="inline-flex items-center gap-1 text-xs text-[#8B45D6] hover:text-[#7135C5] font-semibold transition"
                            >
                              <span>Open</span>
                              <ChevronRight className="h-3.5 w-3.5" />
                            </Link>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteMeeting(m.id, m.title);
                              }}
                              className="p-1 text-[#77738A] hover:text-[#BE123C] hover:bg-[#FDF0F4] rounded-lg transition"
                              title="Delete meeting"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </AppShell>
  );
}
