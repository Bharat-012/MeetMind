'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Layers,
  Users,
  Plus,
  Building,
  Menu,
  X,
  Cpu
} from 'lucide-react';
import IngestModal from '@/components/IngestModal';

interface AppShellProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actionButton?: React.ReactNode;
  activeOrgId?: string;
  onOrgChange?: (orgId: string) => void;
  organizations?: any[];
  showIngestButton?: boolean;
}

export default function AppShell({
  children,
  title,
  subtitle,
  actionButton,
  activeOrgId,
  onOrgChange,
  organizations = [],
  showIngestButton = true,
}: AppShellProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isIngestModalOpen, setIsIngestModalOpen] = useState(false);
  const [backendStatus, setBackendStatus] = useState<'checking' | 'healthy' | 'offline'>('checking');

  useEffect(() => {
    fetch('http://localhost:8000/api/health')
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 'ok') {
          setBackendStatus('healthy');
        } else {
          setBackendStatus('offline');
        }
      })
      .catch(() => setBackendStatus('offline'));
  }, []);

  const navItems = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/workspace', label: 'Meetings Library', icon: Layers },
    { href: '/speakers', label: 'Speaker Directory', icon: Users },
  ];

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const currentOrg = organizations.find((o) => o.id === activeOrgId) || organizations[0];

  return (
    <div className="flex h-screen bg-[#090d16] text-slate-100 overflow-hidden font-sans">
      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 md:hidden transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Primary Sidebar */}
      <aside
        className={`fixed md:static top-0 bottom-0 left-0 z-50 w-64 bg-[#0d131f] border-r border-slate-800/80 flex flex-col justify-between transition-transform duration-200 ease-in-out ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex flex-col flex-1 overflow-y-auto">
          {/* Brand Header */}
          <div className="h-16 px-5 border-b border-slate-800/80 flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-3 group focus:outline-none"
              onClick={() => setMobileMenuOpen(false)}
            >
              <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white text-sm shadow-sm group-hover:bg-indigo-500 transition">
                M
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-sm tracking-tight text-white group-hover:text-indigo-300 transition">
                  MeetMind
                </span>
                <span className="text-[11px] text-slate-400">
                  Meeting Intelligence
                </span>
              </div>
            </Link>

            {/* Mobile Close Button */}
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="md:hidden text-slate-400 hover:text-white p-1 rounded-md"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Organization Indicator / Selector */}
          {organizations.length > 0 && (
            <div className="px-4 py-3 border-b border-slate-800/60 bg-slate-900/30">
              <label className="text-[10px] uppercase font-mono font-semibold text-slate-400 tracking-wider flex items-center gap-1.5 mb-1.5">
                <Building className="h-3 w-3 text-indigo-400" />
                <span>Organization</span>
              </label>
              {onOrgChange && organizations.length > 1 ? (
                <select
                  value={activeOrgId || currentOrg?.id}
                  onChange={(e) => onOrgChange(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-medium"
                >
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="px-2.5 py-1.5 bg-slate-950/60 rounded-lg border border-slate-800/60 text-xs font-medium text-slate-300 truncate">
                  {currentOrg?.name || 'Acme Corp'}
                </div>
              )}
            </div>
          )}

          {/* Mobile-only Ingest Action inside drawer */}
          {showIngestButton && (
            <div className="p-3 md:hidden">
              <button
                onClick={() => {
                  setIsIngestModalOpen(true);
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center justify-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Import Meeting</span>
              </button>
            </div>
          )}

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            <span className="px-3 text-[10px] uppercase font-mono font-semibold text-slate-400 tracking-wider block mb-2">
              Workspace
            </span>
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition ${
                    active
                      ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50 border border-transparent'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${active ? 'text-indigo-400' : 'text-slate-400'}`} />
                  <span className="flex-1">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer: Hardware Status */}
        <div className="p-3.5 border-t border-slate-800/80 bg-slate-950/40 text-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
              <Cpu className="h-3.5 w-3.5 text-indigo-400" />
              <span>Engine Status</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className={`h-2 w-2 rounded-full ${
                  backendStatus === 'healthy'
                    ? 'bg-emerald-400'
                    : backendStatus === 'checking'
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-rose-500'
                }`}
              />
              <span className="text-[10px] font-mono text-slate-400">
                {backendStatus === 'healthy' ? 'Online' : backendStatus === 'checking' ? 'Checking' : 'Offline'}
              </span>
            </span>
          </div>
          <p className="text-[10px] text-slate-400 font-mono">
            Nemotron-3 • Faster-Whisper
          </p>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#090d16] overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-16 border-b border-slate-800/80 bg-[#0d131f]/90 px-4 md:px-8 flex items-center justify-between sticky top-0 z-20 backdrop-blur">
          <div className="flex items-center gap-3 min-w-0">
            {/* Hamburger Button (Mobile Only) */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 border border-slate-700/60"
              title="Open Navigation Menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            {title && (
              <div className="min-w-0">
                <h1 className="font-semibold text-sm md:text-base text-white truncate">{title}</h1>
                {subtitle && (
                  <p className="text-xs text-slate-400 truncate hidden sm:block">{subtitle}</p>
                )}
              </div>
            )}
          </div>

          {/* Top Bar Action Area */}
          <div className="flex items-center gap-2.5">
            {actionButton}
            {showIngestButton && (
              <button
                onClick={() => setIsIngestModalOpen(true)}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium shadow-sm transition"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Import Meeting</span>
              </button>
            )}
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Global Ingestion Modal */}
      <IngestModal
        isOpen={isIngestModalOpen}
        onClose={() => setIsIngestModalOpen(false)}
        organizationId={activeOrgId || currentOrg?.id || ''}
        workspaceId={activeOrgId || currentOrg?.id || ''}
        onSuccess={(createdMeeting: any) => {
          setIsIngestModalOpen(false);
          if (createdMeeting?.id) {
            window.location.href = `/meetings/${createdMeeting.id}`;
          }
        }}
      />
    </div>
  );
}
