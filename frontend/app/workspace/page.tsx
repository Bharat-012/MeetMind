'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Search,
  Video,
  ChevronRight,
  Clock,
  Tv,
  Calendar,
  Layers,
  Sparkles
} from 'lucide-react';
import AppShell from '@/components/AppShell';

export default function WorkspacePage() {
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [meetings, setMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters for meetings list
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  useEffect(() => {
    // 1. Fetch organizations
    fetch('http://localhost:8000/api/organizations')
      .then((res) => res.json())
      .then((orgs) => {
        if (orgs && orgs.length > 0) {
          setOrganizations(orgs);
          setSelectedOrgId(orgs[0].id);
        }
      })
      .catch((err) => console.error(err));

    // 2. Fetch meetings immediately in parallel for near-zero wait time
    fetch('http://localhost:8000/api/meetings')
      .then((res) => res.json())
      .then((data) => {
        setMeetings(data.items || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const handleOrgChange = (orgId: string) => {
    setSelectedOrgId(orgId);
    setLoading(true);
    fetch(`http://localhost:8000/api/meetings?organization_id=${orgId}`)
      .then((res) => res.json())
      .then((data) => {
        setMeetings(data.items || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
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
      subtitle="Searchable library of speech transcripts, intelligence, and meeting recordings"
      activeOrgId={selectedOrgId}
      onOrgChange={handleOrgChange}
      organizations={organizations}
    >
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
        {/* Search and Filters Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-3xl bg-white border border-[#E9E4F2] shadow-soft-card">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-[#9D99AF]" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search meetings by title or description..."
              className="w-full pl-10 pr-4 py-2.5 bg-[#FAF8FF] border border-[#E9E4F2] rounded-2xl text-xs text-[#252238] placeholder-[#9D99AF] focus:outline-none focus:border-[#8B45D6] focus:bg-white transition"
            />
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-[#77738A]">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#FAF8FF] border border-[#E9E4F2] rounded-2xl px-3.5 py-2 text-xs text-[#252238] font-medium focus:outline-none focus:border-[#8B45D6] shadow-xs"
            >
              <option value="ALL">All Statuses ({meetings.length})</option>
              <option value="COMPLETED">Completed</option>
              <option value="TRANSCRIBING">Transcribing</option>
              <option value="DIARIZING">Diarizing</option>
              <option value="GENERATING_SUMMARY">Generating Summary</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>
        </div>

        {/* Content Display: Shimmer Skeleton while loading, else Cards Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((idx) => (
              <div
                key={idx}
                className="p-6 rounded-3xl bg-white border border-[#E9E4F2] shadow-soft-card space-y-4 animate-pulse"
              >
                <div className="flex items-center justify-between">
                  <div className="h-5 w-20 bg-[#F3F0FF] rounded-lg" />
                  <div className="h-5 w-24 bg-[#EBF9F0] rounded-full" />
                </div>
                <div className="space-y-2">
                  <div className="h-4 w-3/4 bg-[#F3F0FF] rounded-md" />
                  <div className="h-3 w-full bg-[#FAF8FF] rounded-md" />
                  <div className="h-3 w-5/6 bg-[#FAF8FF] rounded-md" />
                </div>
                <div className="pt-4 border-t border-[#F0ECF8] flex items-center justify-between">
                  <div className="h-3 w-20 bg-[#F3F0FF] rounded-md" />
                  <div className="h-3 w-12 bg-[#F3ECFE] rounded-md" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredMeetings.length === 0 ? (
          <div className="p-12 text-center rounded-3xl border border-dashed border-[#DDD5FF] bg-white shadow-soft-card space-y-3">
            <div className="h-12 w-12 rounded-2xl bg-[#F3ECFE] text-[#8B45D6] flex items-center justify-center mx-auto">
              <Video className="h-6 w-6" />
            </div>
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
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-bold">
                        {isYouTube ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#FDF0F4] text-[#BE123C] border border-[#FBCDD9]">
                            <Tv className="h-3 w-3" />
                            <span>YouTube</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#F3ECFE] text-[#8B45D6] border border-[#E0CFFC]">
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

                  <div className="pt-4 mt-4 border-t border-[#F0ECF8] flex items-center justify-between text-xs text-[#77738A]">
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
    </AppShell>
  );
}
