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
  Cpu,
  Sparkles
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
    { href: '/', label: 'Overview', icon: LayoutDashboard },
    { href: '/workspace', label: 'Meetings', icon: Layers },
  ];

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const currentOrg = organizations.find((o) => o.id === activeOrgId) || organizations[0];

  return (
    <div className="flex h-screen bg-[#F3F0FF] text-[#252238] overflow-hidden font-sans">
      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-[#252238]/40 backdrop-blur-sm z-40 md:hidden transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Primary Sidebar (Premium Lavender / White Surface) */}
      <aside
        className={`fixed md:static top-0 bottom-0 left-0 z-50 w-64 bg-white border-r border-[#E9E4F2] flex flex-col justify-between transition-transform duration-200 ease-in-out shadow-[4px_0_24px_rgba(139,69,214,0.03)] ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex flex-col flex-1 overflow-y-auto">
          {/* Brand Header */}
          <div className="h-18 px-5 py-4 border-b border-[#F0ECF8] flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-3 group focus:outline-none"
              onClick={() => setMobileMenuOpen(false)}
            >
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#7135C5] via-[#8B45D6] to-[#C23DB4] flex items-center justify-center font-bold text-white text-base shadow-[0_4px_12px_rgba(139,69,214,0.35)] group-hover:scale-105 transition">
                M
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-base tracking-tight text-[#252238] group-hover:text-[#8B45D6] transition">
                  MeetMind
                </span>
                <span className="text-[11px] font-medium text-[#77738A]">
                  Meeting Intelligence
                </span>
              </div>
            </Link>

            {/* Mobile Close Button */}
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="md:hidden text-[#77738A] hover:text-[#252238] p-1.5 rounded-lg hover:bg-[#F3F0FF]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Organization Indicator / Selector */}
          {organizations.length > 0 && (
            <div className="px-4 py-3 mx-3 my-3 rounded-xl bg-[#FAF8FF] border border-[#EAE5FF]">
              <label className="text-[10px] uppercase font-bold text-[#8B45D6] tracking-wider flex items-center gap-1.5 mb-1">
                <Building className="h-3 w-3" />
                <span>Organization</span>
              </label>
              {onOrgChange && organizations.length > 1 ? (
                <select
                  value={activeOrgId || currentOrg?.id}
                  onChange={(e) => onOrgChange(e.target.value)}
                  className="w-full bg-white border border-[#E9E4F2] rounded-lg px-2.5 py-1.5 text-xs text-[#252238] focus:outline-none focus:border-[#8B45D6] font-medium shadow-xs"
                >
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="text-xs font-semibold text-[#252238] truncate">
                  {currentOrg?.name || 'Workspace'}
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
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#7135C5] to-[#8B45D6] text-white rounded-xl text-xs font-semibold shadow-purple-btn transition"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Import Meeting</span>
              </button>
            </div>
          )}

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            <span className="px-3 text-[10px] uppercase font-bold text-[#9D99AF] tracking-wider block mb-2">
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
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition ${
                    active
                      ? 'bg-[#F3ECFE] text-[#7135C5] font-semibold shadow-xs'
                      : 'text-[#77738A] hover:text-[#252238] hover:bg-[#FAF8FF]'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${active ? 'text-[#8B45D6]' : 'text-[#77738A]'}`} />
                  <span className="flex-1">{item.label}</span>
                  {active && (
                    <span className="h-1.5 w-1.5 rounded-full bg-[#8B45D6]" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>


      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#F3F0FF] overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-16 border-b border-[#E9E4F2] bg-white/80 px-4 md:px-8 flex items-center justify-between sticky top-0 z-20 backdrop-blur-md">
          <div className="flex items-center gap-3 min-w-0">
            {/* Hamburger Button (Mobile Only) */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden text-[#77738A] hover:text-[#252238] p-1.5 rounded-lg hover:bg-[#F3F0FF] border border-[#E9E4F2]"
              title="Open Navigation Menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            {title && (
              <div className="min-w-0">
                <h1 className="font-bold text-sm md:text-base text-[#252238] truncate">{title}</h1>
                {subtitle && (
                  <p className="text-xs text-[#77738A] truncate hidden sm:block">{subtitle}</p>
                )}
              </div>
            )}
          </div>

          {/* Top Bar Action Area */}
          <div className="flex items-center gap-3">
            {actionButton}
            {showIngestButton && (
              <button
                onClick={() => setIsIngestModalOpen(true)}
                className="hidden sm:inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#7135C5] via-[#8B45D6] to-[#C23DB4] text-white rounded-xl text-xs font-semibold shadow-purple-btn hover:opacity-95 transition"
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
