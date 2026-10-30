'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  HelpCircle,
  Calendar,
  User,
  FileText,
  CheckCircle2,
  ListTodo,
  Users,
  MessageSquare,
  Play,
  Pause,
  RotateCcw,
  Search,
  ExternalLink,
  ChevronLeft,
  Sparkles,
  AlertTriangle,
  ArrowRight,
  Check,
  X,
  History,
  UserCheck,
  UserX,
  BarChart3,
  ShieldCheck,
  Video,
  Volume2,
  VolumeX,
  Volume1,
  Maximize,
  RefreshCw,
  Music,
  Tv,
  Send,
  Square,
  Bot,
  Loader2
} from 'lucide-react';

export default function MeetingDetailPage() {
  const params = useParams();
  const meetingId = params?.id as string;

  const [activeTab, setActiveTab] = useState<string>('transcript');
  const [meeting, setMeeting] = useState<any>(null);
  const [mediaInfo, setMediaInfo] = useState<any>(null);
  const [transcriptData, setTranscriptData] = useState<any>(null);
  const [summaryData, setSummaryData] = useState<any>(null);
  const [shortTranscript, setShortTranscript] = useState<any>(null);
  const [decisions, setDecisions] = useState<any[]>([]);
  const [actionItems, setActionItems] = useState<any[]>([]);
  const [speakerStats, setSpeakerStats] = useState<any[]>([]);
  const [orgParticipants, setOrgParticipants] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRegenerating, setIsRegenerating] = useState<boolean>(false);
  const [isRetrying, setIsRetrying] = useState<boolean>(false);

  // Playback & Media state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(1.0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [youtubeMode, setYoutubeMode] = useState<'audio' | 'embed'>('audio');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoContainerRef = useRef<HTMLDivElement | null>(null);

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
      citations: [],
      model_name: 'ollama:llama3.2'
    }
  ]);
  const [chatQuery, setChatQuery] = useState<string>('');
  const [chatLoading, setChatLoading] = useState<boolean>(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [activeModelName, setActiveModelName] = useState<string>('ollama:llama3.2');
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Filters
  const [transcriptSearch, setTranscriptSearch] = useState<string>('');
  const [speakerFilter, setSpeakerFilter] = useState<string>('ALL');

  const fetchMeetingData = async () => {
    try {
      const [mRes, tRes, sRes, stRes, dRes, aRes, statRes, mediaRes] = await Promise.all([
        fetch(`http://localhost:8000/api/meetings/${meetingId}`).catch(() => null),
        fetch(`http://localhost:8000/api/meetings/${meetingId}/transcript`).catch(() => null),
        fetch(`http://localhost:8000/api/meetings/${meetingId}/summary`).catch(() => null),
        fetch(`http://localhost:8000/api/meetings/${meetingId}/short-transcript`).catch(() => null),
        fetch(`http://localhost:8000/api/meetings/${meetingId}/decisions`).catch(() => null),
        fetch(`http://localhost:8000/api/meetings/${meetingId}/action-items`).catch(() => null),
        fetch(`http://localhost:8000/api/meetings/${meetingId}/speakers/stats`).catch(() => null),
        fetch(`http://localhost:8000/api/meetings/${meetingId}/media-info`).catch(() => null),
      ]);

      let meetingObj = null;
      if (mRes && mRes.ok) {
        meetingObj = await mRes.json();
        setMeeting(meetingObj);
        if (meetingObj.duration_seconds && duration === 0) {
          setDuration(Math.round(meetingObj.duration_seconds));
        }
      }

      if (tRes && tRes.ok) setTranscriptData(await tRes.json());
      if (sRes && sRes.ok) setSummaryData(await sRes.json());
      if (stRes && stRes.ok) setShortTranscript(await stRes.json());
      if (dRes && dRes.ok) setDecisions(await dRes.json());
      if (aRes && aRes.ok) setActionItems(await aRes.json());
      if (statRes && statRes.ok) setSpeakerStats(await statRes.json());
      if (mediaRes && mediaRes.ok) {
        const mInfo = await mediaRes.json();
        setMediaInfo(mInfo);
        if (mInfo.duration_seconds && duration === 0) {
          setDuration(Math.round(mInfo.duration_seconds));
        }
      }

      // Fetch suggested questions for meeting
      fetch(`http://localhost:8000/api/chat/suggested-questions?meeting_id=${meetingId}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.questions && data.questions.length > 0) {
            setSuggestedQuestions(data.questions);
          }
        })
        .catch(() => {});

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

    // Active polling while meeting is processing
    const pollInterval = setInterval(() => {
      fetch(`http://localhost:8000/api/meetings/${meetingId}`)
        .then((res) => res.ok ? res.json() : null)
        .then((latestMeeting) => {
          if (!latestMeeting) return;
          const status = latestMeeting.status;
          const isDone = status === 'COMPLETED' || status === 'FAILED' || status === 'CANCELLED';
          setMeeting(latestMeeting);
          if (!isDone) {
            // Also refresh media-info
            fetch(`http://localhost:8000/api/meetings/${meetingId}/media-info`)
              .then((r) => r.ok ? r.json() : null)
              .then((m) => { if (m) setMediaInfo(m); })
              .catch(() => {});
          } else {
            // Processing finished: do a full refresh of deliverables and clear interval
            fetchMeetingData();
            clearInterval(pollInterval);
          }
        })
        .catch(() => {});
    }, 2500);

    return () => clearInterval(pollInterval);
  }, [meetingId]);

  // Media Player Helpers
  const getActiveMedia = (): HTMLMediaElement | null => {
    if (mediaInfo?.has_video && videoRef.current) {
      return videoRef.current;
    }
    return audioRef.current;
  };

  const togglePlay = () => {
    const el = getActiveMedia();
    if (!el) return;
    if (isPlaying) {
      el.pause();
      setIsPlaying(false);
    } else {
      el.play().then(() => setIsPlaying(true)).catch((err) => console.warn('Play error:', err));
    }
  };

  const seekTo = (seconds: number) => {
    const el = getActiveMedia();
    if (el) {
      el.currentTime = seconds;
      el.play().then(() => setIsPlaying(true)).catch(() => {});
    }
    setCurrentTime(seconds);
    setIsPlaying(true);
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetTime = Number(e.target.value);
    seekTo(targetTime);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = Number(e.target.value);
    setVolume(newVol);
    setIsMuted(newVol === 0);
    const el = getActiveMedia();
    if (el) {
      el.volume = newVol;
      el.muted = newVol === 0;
    }
  };

  const toggleMute = () => {
    const el = getActiveMedia();
    if (!el) return;
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    el.muted = nextMuted;
    if (!nextMuted && volume === 0) {
      setVolume(0.5);
      el.volume = 0.5;
    }
  };

  const handlePlaybackRateChange = (rate: number) => {
    setPlaybackRate(rate);
    const el = getActiveMedia();
    if (el) {
      el.playbackRate = rate;
    }
  };

  const handleToggleFullscreen = () => {
    if (videoContainerRef.current) {
      if (!document.fullscreenElement) {
        videoContainerRef.current.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  const handleTimeUpdate = (e: any) => {
    if (e.target && !isNaN(e.target.currentTime)) {
      setCurrentTime(e.target.currentTime);
    }
  };

  const handleLoadedMetadata = (e: any) => {
    if (e.target && e.target.duration && !isNaN(e.target.duration)) {
      setDuration(Math.round(e.target.duration));
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleRetryProcessing = async () => {
    setIsRetrying(true);
    try {
      const res = await fetch(`http://localhost:8000/api/meetings/${meetingId}/retry`, {
        method: 'POST'
      });
      if (res.ok) {
        await fetchMeetingData();
      }
    } catch (err) {
      console.error('Failed to retry processing:', err);
    } finally {
      setIsRetrying(false);
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

  const submitQuery = async (queryText: string) => {
    if (!queryText.trim() || chatLoading || isStreaming) return;

    const userText = queryText.trim();
    setChatQuery('');
    setChatLoading(true);
    setIsStreaming(true);

    // Append user message immediately
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
          meeting_id: meetingId,
          scope: 'SINGLE_MEETING'
        }),
        signal: abortController.signal
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      if (!res.body) {
        throw new Error('No readable stream');
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
                if (event.model_name) {
                  setActiveModelName(event.model_name);
                }
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
              } else if (event.type === 'done') {
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
                if (event.model_name) {
                  setActiveModelName(event.model_name);
                }
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
        // Fallback to standard chat endpoint if stream is unavailable
        try {
          const fallbackRes = await fetch('http://localhost:8000/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query: userText,
              meeting_id: meetingId,
              scope: 'SINGLE_MEETING'
            })
          });
          if (fallbackRes.ok) {
            const data = await fallbackRes.json();
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
              content: 'Could not connect to meeting intelligence engine.',
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

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitQuery(chatQuery);
  };

  const handleSuggestedQuestionClick = (q: string) => {
    submitQuery(q);
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
        content: 'Hello! I am MeetMind Assistant. You can ask me any question about this meeting with timestamped citations.',
        citations: [],
        model_name: activeModelName
      }
    ]);
  };

  // Status mapping
  const status = meeting?.status || 'UPLOADED';
  const isCompleted = status === 'COMPLETED';
  const isFailed = status === 'FAILED';
  const isProcessing = !isCompleted && !isFailed && status !== 'CANCELLED';

  const stageDescriptions: Record<string, { label: string; percent: number }> = {
    QUEUED: { label: 'Queued for processing', percent: 5 },
    UPLOADED: { label: 'Media uploaded', percent: 10 },
    VALIDATING: { label: 'Validating media container & codecs', percent: 15 },
    EXTRACTING_MEDIA: { label: 'Extracting 16kHz mono audio', percent: 25 },
    TRANSCRIBING: { label: 'Speech recognition (Faster-Whisper)', percent: 45 },
    DIARIZING: { label: 'Speaker diarization (NVIDIA Nemotron-3)', percent: 65 },
    ALIGNING_SPEAKERS: { label: 'Aligning speaker turns & timestamps', percent: 75 },
    GENERATING_SUMMARY: { label: 'Generating meeting intelligence & summary', percent: 85 },
    INDEXING_KNOWLEDGE: { label: 'Indexing vector embeddings for QA', percent: 95 },
    COMPLETED: { label: 'Processing complete', percent: 100 },
    FAILED: { label: 'Processing failed', percent: 0 },
  };

  const currentStageInfo = stageDescriptions[status] || { label: status, percent: 50 };

  // Determine media presentation
  const hasVideo = Boolean(mediaInfo?.has_video);
  const isYouTube = Boolean(mediaInfo?.is_youtube || meeting?.source_type === 'YOUTUBE');
  const isYouTubeAudioOnly = isYouTube && !hasVideo;
  const isAudioOnly = !hasVideo && !isYouTube;

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
    <div className="flex h-screen bg-[#090d16] text-slate-100 overflow-hidden font-sans">
      <div className="flex-1 flex flex-col min-w-0 bg-[#090d16] overflow-y-auto">

        {/* TOP HEADER */}
        <header className="h-16 border-b border-slate-800 bg-[#0d121f]/90 px-6 flex items-center justify-between sticky top-0 z-20 backdrop-blur">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/workspace"
              className="text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-slate-800/80 transition flex items-center gap-1.5 text-xs font-medium border border-slate-800/80 flex-shrink-0"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Workspace</span>
            </Link>

            <span className="text-slate-600 text-xs hidden sm:inline">/</span>

            <h1 className="font-semibold text-sm text-white truncate max-w-sm sm:max-w-md" title={meeting?.title}>
              {meeting?.title || 'Meeting Details'}
            </h1>

            {/* Status Badge */}
            <span className={`text-[11px] font-mono px-2.5 py-0.5 rounded-full border flex-shrink-0 ${
              isCompleted
                ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/40'
                : isFailed
                ? 'bg-rose-950/60 text-rose-400 border-rose-800/40'
                : 'bg-indigo-950/60 text-indigo-300 border-indigo-800/40 animate-pulse'
            }`}>
              {status}
            </span>

            {/* Source Badge */}
            {isYouTube ? (
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-red-950/60 text-red-400 border border-red-800/40">
                <Tv className="h-3 w-3" />
                <span>YouTube</span>
              </span>
            ) : hasVideo ? (
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-indigo-950/60 text-indigo-400 border border-indigo-800/40">
                <Video className="h-3 w-3" />
                <span>Video MP4</span>
              </span>
            ) : (
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                <Music className="h-3 w-3" />
                <span>Audio Recording</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5 flex-shrink-0">
            {isFailed && (
              <button
                onClick={handleRetryProcessing}
                disabled={isRetrying}
                className="flex items-center gap-1.5 text-xs text-rose-300 hover:text-white font-medium px-3 py-1.5 rounded-lg border border-rose-800/60 bg-rose-950/60 hover:bg-rose-900/60 transition disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
                <span>Retry Processing</span>
              </button>
            )}

            <button
              onClick={handleRegenerateIntelligence}
              disabled={isRegenerating || isProcessing}
              className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white font-medium px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 transition disabled:opacity-50 shadow-sm"
              title="Regenerate summary, decisions, and action items from transcript"
            >
              <Sparkles className={`h-3.5 w-3.5 text-indigo-400 ${isRegenerating ? 'animate-spin' : ''}`} />
              <span className="hidden md:inline">{isRegenerating ? 'Regenerating...' : 'Regenerate Intelligence'}</span>
            </button>

            <Link
              href="/speakers"
              className="flex items-center gap-1.5 text-xs text-indigo-300 hover:text-white font-medium px-3 py-1.5 rounded-lg border border-indigo-900/40 bg-indigo-950/40 hover:bg-indigo-900/50 transition shadow-sm"
            >
              <Users className="h-3.5 w-3.5 text-indigo-400" />
              <span className="hidden md:inline">Speaker Directory</span>
            </Link>
          </div>
        </header>

        {/* PROCESSING IN PROGRESS BANNER */}
        {isProcessing && (
          <div className="bg-gradient-to-r from-indigo-950/90 via-slate-900 to-indigo-950/90 border-b border-indigo-800/40 px-6 py-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <RefreshCw className="h-4 w-4 text-indigo-400 animate-spin flex-shrink-0" />
              <div>
                <span className="font-semibold text-white">Pipeline Processing: </span>
                <span className="text-indigo-300 font-medium">{currentStageInfo.label}</span>
                <span className="text-slate-400 block sm:inline sm:ml-2 text-[11px]">
                  (Live updating automatically · {currentStageInfo.percent}% complete)
                </span>
              </div>
            </div>
            <div className="w-full sm:w-48 bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700">
              <div
                className="bg-indigo-500 h-full rounded-full transition-all duration-500 animate-pulse"
                style={{ width: `${currentStageInfo.percent}%` }}
              />
            </div>
          </div>
        )}

        {/* PROCESSING FAILED ALERT BANNER */}
        {isFailed && (
          <div className="bg-rose-950/80 border-b border-rose-800/40 px-6 py-3 flex items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-4 w-4 text-rose-400 flex-shrink-0" />
              <div>
                <span className="font-semibold text-rose-200">Pipeline Failed: </span>
                <span className="text-slate-300">{meeting?.error_message || 'An error halted media processing.'}</span>
              </div>
            </div>
            <button
              onClick={handleRetryProcessing}
              disabled={isRetrying}
              className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium flex items-center gap-1.5 transition flex-shrink-0 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* REDESIGNED MEDIA AREA */}
        <section className="bg-[#0b101d] border-b border-slate-800/80 p-6 flex flex-col items-center">
          <div className="w-full max-w-4xl space-y-4">

            {/* 1. LOCAL VIDEO OR YOUTUBE WITH REAL VIDEO FRAMES */}
            {hasVideo && (
              <div className="flex flex-col items-center space-y-3">
                <div
                  ref={videoContainerRef}
                  className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden border border-slate-800 shadow-2xl flex items-center justify-center group"
                >
                  <video
                    ref={videoRef}
                    src={`http://localhost:8000/api/meetings/${meetingId}/media`}
                    poster={mediaInfo?.thumbnail_url || undefined}
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleLoadedMetadata}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onEnded={() => setIsPlaying(false)}
                    onError={() => setVideoError('Direct video stream playback error. Fallback audio active.')}
                    className="w-full h-full object-contain"
                    playsInline
                  />

                  {/* Play Overlay Button */}
                  {!isPlaying && (
                    <button
                      onClick={togglePlay}
                      className="absolute inset-0 m-auto h-16 w-16 rounded-full bg-indigo-600/90 hover:bg-indigo-500 text-white flex items-center justify-center shadow-xl shadow-indigo-900/50 transition transform hover:scale-110"
                      title="Play Video"
                    >
                      <Play className="h-8 w-8 ml-1" />
                    </button>
                  )}

                  {/* Top Video Badges */}
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold bg-black/70 backdrop-blur text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5 shadow">
                      <Video className="h-3.5 w-3.5 text-indigo-400" />
                      <span>{mediaInfo?.video_codec?.toUpperCase() || 'MP4 VIDEO'}</span>
                    </span>
                    {mediaInfo?.is_youtube && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-red-600/90 text-white shadow">
                        YouTube
                      </span>
                    )}
                  </div>
                </div>

                {mediaInfo?.codec_warning && (
                  <div className="w-full p-2.5 rounded-lg bg-amber-950/40 border border-amber-800/40 text-amber-400 text-xs flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                    <span>{mediaInfo.codec_warning}</span>
                  </div>
                )}
              </div>
            )}

            {/* 2. YOUTUBE IMPORTS (AUDIO TRACK LEGALLY EXTRACTED) */}
            {isYouTubeAudioOnly && (
              <div className="w-full flex flex-col space-y-3">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-red-500" />
                    <span className="text-xs font-medium text-white">YouTube Media</span>
                    <span className="text-[11px] text-slate-400">
                      Synchronized audio & transcript
                    </span>
                  </div>

                  {mediaInfo?.video_id && (
                    <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-lg border border-slate-800">
                      <button
                        onClick={() => setYoutubeMode('audio')}
                        className={`px-3 py-1 rounded text-xs font-medium transition ${
                          youtubeMode === 'audio'
                            ? 'bg-indigo-600 text-white shadow'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Synced Audio Player
                      </button>
                      <button
                        onClick={() => setYoutubeMode('embed')}
                        className={`px-3 py-1 rounded text-xs font-medium transition ${
                          youtubeMode === 'embed'
                            ? 'bg-indigo-600 text-white shadow'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Watch on YouTube
                      </button>
                    </div>
                  )}
                </div>

                {youtubeMode === 'embed' && mediaInfo?.video_id ? (
                  <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${mediaInfo.video_id}?start=${Math.floor(currentTime)}&autoplay=1`}
                      title={meeting?.title || 'YouTube Player'}
                      className="w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900/90 to-indigo-950/40 p-5 shadow-xl flex flex-col sm:flex-row items-center gap-5">
                    {/* Thumbnail Artwork with Play Trigger */}
                    <div className="relative w-full sm:w-56 aspect-video rounded-xl overflow-hidden border border-slate-700/60 shadow-lg flex-shrink-0 bg-black flex items-center justify-center group">
                      {mediaInfo?.thumbnail_url ? (
                        <img
                          src={mediaInfo.thumbnail_url}
                          alt={meeting?.title || 'YouTube Thumbnail'}
                          className="w-full h-full object-cover opacity-85 group-hover:opacity-100 transition"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-950 text-slate-600">
                          <Tv className="h-10 w-10" />
                        </div>
                      )}
                      <button
                        onClick={togglePlay}
                        className="absolute inset-0 m-auto h-12 w-12 rounded-full bg-indigo-600/95 hover:bg-indigo-500 text-white flex items-center justify-center shadow-lg transition transform group-hover:scale-110"
                        title={isPlaying ? 'Pause' : 'Play Audio'}
                      >
                        {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
                      </button>
                    </div>

                    {/* Metadata details */}
                    <div className="flex-1 w-full space-y-1.5 text-center sm:text-left">
                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-red-600/20 text-red-400 border border-red-500/30">
                          YouTube Audio Extracted
                        </span>
                        {mediaInfo?.channel && (
                          <span className="text-xs text-slate-400">Channel: {mediaInfo.channel}</span>
                        )}
                        <span className="text-xs text-slate-500 font-mono">
                          Duration: {formatTime(duration)}
                        </span>
                      </div>
                      <h3 className="text-base font-semibold text-white line-clamp-1">{meeting?.title}</h3>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Extracted audio track is synchronized with speech transcript turns. Click any transcript timestamp to jump to that moment in the recording.
                      </p>
                      {mediaInfo?.source_url && (
                        <a
                          href={mediaInfo.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-medium pt-1 transition"
                        >
                          <span>Open original YouTube stream</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 3. AUDIO-ONLY RECORDING (LOCAL WAV/MP3) */}
            {isAudioOnly && (
              <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-indigo-950/40 border border-slate-800 shadow-xl flex flex-col sm:flex-row items-center gap-6">
                <div className="h-20 w-20 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0 text-indigo-400 shadow-inner">
                  <Music className="h-9 w-9" />
                </div>
                <div className="flex-1 w-full space-y-1.5 text-center sm:text-left">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-indigo-950/80 text-indigo-300 border border-indigo-800/50">
                      AUDIO RECORDING · {mediaInfo?.audio_codec?.toUpperCase() || 'WAV'}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      Duration: {formatTime(duration)}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-white truncate">{meeting?.title}</h3>
                  <p className="text-xs text-slate-400">
                    High-fidelity 16kHz audio processed by local Faster-Whisper and NVIDIA Nemotron-3-Diarization.
                  </p>
                </div>
              </div>
            )}

            {/* HIDDEN AUDIO ELEMENT (active for audio-only, youtube-audio, or when video is collapsed) */}
            {(!hasVideo || videoError) && (
              <audio
                ref={audioRef}
                src={`http://localhost:8000/api/meetings/${meetingId}/media`}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
              />
            )}

            {/* UNIFIED CONTROLS BAR (Hidden when watching native YouTube embed) */}
            {(!isYouTubeAudioOnly || youtubeMode === 'audio') && (
            <div className="p-4 rounded-xl bg-[#0e1526] border border-slate-800/80 shadow-md flex flex-col gap-3">
              {/* Scrubber slider and time display */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-indigo-300 w-12 text-right">
                  {formatTime(currentTime)}
                </span>
                <div className="flex-1 relative flex items-center">
                  <input
                    type="range"
                    min="0"
                    max={duration || 100}
                    step="0.1"
                    value={currentTime}
                    onChange={handleSliderChange}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400 transition"
                  />
                </div>
                <span className="text-xs font-mono text-slate-400 w-12">
                  {formatTime(duration)}
                </span>
              </div>

              {/* Controls row */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
                <div className="flex items-center gap-2 sm:gap-3">
                  <button
                    onClick={togglePlay}
                    className="h-9 w-9 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center transition shadow-md shadow-indigo-600/30"
                    title={isPlaying ? 'Pause' : 'Play'}
                  >
                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
                  </button>

                  <button
                    onClick={() => seekTo(Math.max(0, currentTime - 5))}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition text-xs flex items-center gap-0.5"
                    title="Rewind 5s"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span className="text-[11px]">-5s</span>
                  </button>

                  <button
                    onClick={() => seekTo(Math.min(duration, currentTime + 5))}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition text-xs flex items-center gap-0.5"
                    title="Forward 5s"
                  >
                    <RotateCcw className="h-3.5 w-3.5 transform rotate-180" />
                    <span className="text-[11px]">+5s</span>
                  </button>

                  {/* Volume Slider */}
                  <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-slate-800">
                    <button
                      onClick={toggleMute}
                      className="text-slate-400 hover:text-white transition"
                      title={isMuted ? 'Unmute' : 'Mute'}
                    >
                      {isMuted || volume === 0 ? (
                        <VolumeX className="h-4 w-4 text-rose-400" />
                      ) : volume < 0.5 ? (
                        <Volume1 className="h-4 w-4" />
                      ) : (
                        <Volume2 className="h-4 w-4" />
                      )}
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      className="w-16 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 hidden sm:block"
                      title={`Volume: ${Math.round((isMuted ? 0 : volume) * 100)}%`}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-3">
                  {/* Playback Speed Buttons */}
                  <div className="flex items-center gap-1">
                    <span className="text-slate-500 text-[10px] hidden sm:inline">Speed:</span>
                    {[1.0, 1.25, 1.5, 2.0].map((rate) => (
                      <button
                        key={rate}
                        onClick={() => handlePlaybackRateChange(rate)}
                        className={`px-2 py-0.5 rounded text-[11px] font-mono transition ${
                          playbackRate === rate
                            ? 'bg-indigo-600 text-white font-bold'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                      >
                        {rate}x
                      </button>
                    ))}
                  </div>

                  {/* Fullscreen Button (if Video) */}
                  {hasVideo && (
                    <button
                      onClick={handleToggleFullscreen}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                      title="Fullscreen"
                    >
                      <Maximize className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
            )}

          </div>
        </section>

        {/* RESPONSIVE NAVIGATION TABS BAR */}
        <div className="border-b border-slate-800/80 bg-[#0d131f]/95 px-6 py-2 sticky top-16 z-10 backdrop-blur">
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-1">
            {[
              { id: 'transcript', label: 'Transcript', icon: FileText },
              { id: 'summary', label: 'Summary', icon: Sparkles },
              { id: 'actions', label: 'Action Items', icon: ListTodo, badge: actionItems.length },
              { id: 'speakers', label: 'Speakers', icon: Users, badge: transcriptData?.speakers?.length },
              { id: 'chat', label: 'Chat', icon: MessageSquare },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-2 px-3.5 rounded-lg text-xs font-medium flex items-center gap-2 whitespace-nowrap transition ${
                    active
                      ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
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
        </div>

        {/* TAB CONTENT DISPLAY AREA */}
        <div className="flex-1 p-6">
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

              {filteredSegments.length === 0 ? (
                <div className="p-12 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 text-slate-400 text-xs">
                  {isProcessing
                    ? 'Transcribing audio turns with Faster-Whisper... transcript will appear once completed.'
                    : 'No transcript segments found matching your filters.'}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredSegments.map((seg: any) => {
                    const isCurrent = currentTime >= seg.start_time && currentTime <= seg.end_time;
                    return (
                      <div
                        key={seg.id}
                        onClick={() => seekTo(seg.start_time)}
                        className={`p-4 rounded-xl border transition cursor-pointer ${
                          isCurrent
                            ? 'bg-indigo-950/50 border-indigo-500/60 shadow-lg shadow-indigo-950/50'
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
              )}
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
                  {summaryData?.executive_summary || (
                    isCompleted
                      ? 'No executive summary was generated for this meeting.'
                      : 'Summary is being computed by the local model...'
                  )}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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


          {/* TAB 5: ACTION ITEMS */}
          {activeTab === 'actions' && (
            <div className="max-w-4xl mx-auto space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Action Item Tracker</h3>
                <span className="text-xs text-slate-400">{actionItems.length} items</span>
              </div>

              {actionItems.length === 0 ? (
                <div className="p-10 text-center rounded-xl bg-[#0e1526]/50 border border-dashed border-slate-800 space-y-2">
                  <ListTodo className="h-6 w-6 text-slate-500 mx-auto" />
                  <p className="text-xs font-medium text-slate-300">
                    {isCompleted
                      ? 'No action items extracted from this meeting.'
                      : 'Action items will appear here once pipeline completes.'}
                  </p>
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
              {speakerStats.length > 0 && (
                <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-4">
                  <h3 className="text-xs uppercase tracking-wider text-slate-400 font-bold flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-indigo-400" />
                    <span>Meeting Talk-Time Distribution</span>
                  </h3>

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
            <div className="max-w-4xl mx-auto flex flex-col h-[680px] bg-[#0c1220] rounded-2xl border border-slate-800 shadow-2xl overflow-hidden">
              {/* Chat Header Bar */}
              <div className="px-5 py-3.5 border-b border-slate-800 bg-[#0f172a] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-white flex items-center gap-2">
                      <span>Meeting Conversational Intelligence</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-indigo-800/50 bg-indigo-950/60 text-indigo-300 flex items-center gap-1.5 font-normal">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span>{activeModelName}</span>
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Grounded strictly in transcribed dialogue, verified decisions, and assigned action items.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleClearChat}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-xl border border-slate-800 hover:border-slate-700 bg-slate-900/80 transition"
                  title="Clear conversation and reset context"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>New Chat</span>
                </button>
              </div>

              {/* Suggested Questions Pills */}
              {suggestedQuestions.length > 0 && (
                <div className="px-5 py-2.5 border-b border-slate-800/80 bg-slate-900/40">
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
                    <span className="text-[10px] uppercase font-mono font-semibold tracking-wider text-slate-400 flex-shrink-0 flex items-center gap-1">
                      <Sparkles className="h-2.5 w-2.5 text-indigo-400" />
                      <span>Suggested:</span>
                    </span>
                    {suggestedQuestions.map((q, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSuggestedQuestionClick(q)}
                        disabled={chatLoading || isStreaming}
                        className="text-[11px] text-indigo-300 hover:text-white bg-indigo-950/40 hover:bg-indigo-900/60 border border-indigo-800/40 hover:border-indigo-600/50 px-3 py-1 rounded-full whitespace-nowrap transition flex-shrink-0 disabled:opacity-50"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Messages Scroll Area */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {chatMessages.map((msg, i) => {
                  const isUser = msg.role === 'user';
                  return (
                    <div
                      key={i}
                      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed ${
                          isUser
                            ? 'bg-indigo-600 text-white rounded-br-none shadow-md'
                            : 'bg-slate-900/90 border border-slate-800 text-slate-200 rounded-bl-none shadow-sm'
                        }`}
                      >
                        {/* Model tag for assistant */}
                        {!isUser && msg.model_name && (
                          <div className="flex items-center gap-1 text-[10px] font-mono text-slate-400 mb-2 pb-1.5 border-b border-slate-800/80">
                            <Bot className="h-3 w-3 text-indigo-400" />
                            <span>{msg.model_name}</span>
                          </div>
                        )}

                        {/* Content text */}
                        <div className="whitespace-pre-wrap leading-relaxed">
                          {msg.content}
                          {msg.isStreaming && (
                            <span className="inline-block w-2 h-3.5 bg-indigo-400 ml-1 animate-pulse align-middle" />
                          )}
                        </div>

                        {/* Evidence Citations */}
                        {msg.citations && msg.citations.length > 0 && (
                          <div className="mt-3.5 pt-3 border-t border-slate-800/90 space-y-2">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-400 block">
                              Verifiable Evidence Citations (Click to Seek Media Player):
                            </span>
                            <div className="space-y-1.5">
                              {msg.citations.map((c: any, ci: number) => {
                                const ts = c.timestamp_start !== undefined && c.timestamp_start !== null ? c.timestamp_start : c.timestamp;
                                return (
                                  <button
                                    key={ci}
                                    type="button"
                                    onClick={() => {
                                      if (ts !== undefined && ts !== null) {
                                        seekTo(ts);
                                      }
                                    }}
                                    className="w-full text-left text-[11px] text-slate-300 bg-slate-950/80 hover:bg-indigo-950/30 p-2.5 rounded-xl border border-slate-800/80 hover:border-indigo-500/50 transition flex items-start justify-between gap-3 group"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <span className="font-semibold text-indigo-300">
                                        {c.speaker_name || c.speaker_label || 'Speaker'}:
                                      </span>{' '}
                                      <span className="italic text-slate-300">"{c.quote}"</span>
                                    </div>

                                    {ts !== null && ts !== undefined && (
                                      <span className="font-mono text-indigo-400 group-hover:text-indigo-300 flex-shrink-0 bg-indigo-950/90 border border-indigo-800/60 px-2 py-0.5 rounded text-[10px] flex items-center gap-1 shadow-sm">
                                        <Play className="h-2.5 w-2.5 fill-indigo-400" />
                                        <span>[{formatTime(ts)}]</span>
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {chatLoading && !isStreaming && (
                  <div className="p-3 bg-slate-900 border border-slate-800 text-slate-400 rounded-xl text-xs flex items-center gap-2 max-w-xs animate-pulse">
                    <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
                    <span>Synthesizing grounded answer...</span>
                  </div>
                )}
              </div>

              {/* Chat Form */}
              <form onSubmit={handleChatSubmit} className="p-3.5 border-t border-slate-800 bg-slate-900/60 flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Ask a question about this meeting (e.g. What were the key decisions?)..."
                  value={chatQuery}
                  onChange={(e) => setChatQuery(e.target.value)}
                  disabled={isStreaming}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 disabled:opacity-60"
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
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs px-4 py-2.5 rounded-xl font-medium transition flex items-center gap-1.5 shadow-sm"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>Ask</span>
                  </button>
                )}
              </form>
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
