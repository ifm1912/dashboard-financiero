'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDateRange, DateRangePreset } from '@/contexts/DateRangeContext';
import { DataFreshness } from '@/lib/data';

const dateRangeOptions: { value: DateRangePreset; label: string }[] = [
  { value: '7d', label: '7 días' },
  { value: '30d', label: '30 días' },
  { value: '90d', label: '90 días' },
  { value: '12m', label: '12 meses' },
  { value: 'all', label: 'Todo' },
];

const MONTH_NAMES: Record<string, string> = {
  '01': 'Ene', '02': 'Feb', '03': 'Mar', '04': 'Abr',
  '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Ago',
  '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dic',
};

function FreshnessBadge() {
  const [freshness, setFreshness] = useState<DataFreshness | null>(null);

  useEffect(() => {
    fetch('/data/data_freshness.json')
      .then(r => r.ok ? r.json() : null)
      .then(setFreshness)
      .catch(() => setFreshness(null));
  }, []);

  if (!freshness) return null;

  const lastUpdate = new Date(freshness.last_update);
  const daysSince = Math.floor((Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24));

  const monthParts = freshness.month_closed?.split('-');
  const monthLabel = monthParts
    ? `${MONTH_NAMES[monthParts[1]] || monthParts[1]} ${monthParts[0]?.slice(-2)}`
    : null;

  const color = daysSince <= 35
    ? 'bg-success/15 text-success border-success/30'
    : daysSince <= 60
    ? 'bg-warning/15 text-warning border-warning/30'
    : 'bg-danger/15 text-danger border-danger/30';

  return (
    <span className={`hidden sm:inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium ${color}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${daysSince <= 35 ? 'bg-success' : daysSince <= 60 ? 'bg-warning' : 'bg-danger'}`} />
      Datos: {monthLabel}
    </span>
  );
}

interface HeaderProps {
  onToggleSidebar: () => void;
}

export function Header({ onToggleSidebar }: HeaderProps) {
  const { preset, setPreset } = useDateRange();
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  return (
    <header className="fixed top-0 right-0 left-0 lg:left-52 z-30 h-14 border-b border-border-subtle bg-bg-base/80 backdrop-blur-sm">
      <div className="flex h-full items-center justify-between px-4 sm:px-6 md:px-8">
        {/* Left - Hamburger + Title */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSidebar}
            className="rounded-lg p-1.5 text-text-muted hover:bg-bg-surface hover:text-text-primary lg:hidden"
            aria-label="Toggle sidebar"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-base font-semibold text-text-primary tracking-tight">
            GPT Finance
          </h1>
          <span className="hidden sm:inline text-xs text-text-dimmed">Dashboard</span>
          <FreshnessBadge />
        </div>

        {/* Right - Controls */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Date Range Selector - Desktop */}
          <div className="hidden sm:flex items-center gap-1 rounded-lg border border-border-subtle bg-bg-surface p-0.5">
            {dateRangeOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setPreset(option.value)}
                className={`px-2 sm:px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  preset === option.value
                    ? 'bg-bg-elevated text-text-primary'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* Date Range Selector - Mobile dropdown */}
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value as DateRangePreset)}
            className="sm:hidden rounded-lg border border-border-subtle bg-bg-surface px-2 py-1 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
          >
            {dateRangeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          {/* Avatar y Logout */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={handleLogout}
              className="hidden sm:block text-xs text-text-muted hover:text-text-primary transition-colors"
            >
              Salir
            </button>
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-accent to-accent-light flex items-center justify-center">
              <span className="text-xs font-medium text-white">IF</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
