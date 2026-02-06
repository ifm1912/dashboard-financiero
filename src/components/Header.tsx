'use client';

import { useRouter } from 'next/navigation';
import { useDateRange, DateRangePreset } from '@/contexts/DateRangeContext';

const dateRangeOptions: { value: DateRangePreset; label: string }[] = [
  { value: '7d', label: '7 días' },
  { value: '30d', label: '30 días' },
  { value: '90d', label: '90 días' },
  { value: '12m', label: '12 meses' },
  { value: 'all', label: 'Todo' },
];

export function Header() {
  const { preset, setPreset } = useDateRange();
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  return (
    <header className="fixed top-0 right-0 left-52 z-30 h-14 border-b border-border-subtle bg-bg-base/80 backdrop-blur-sm">
      <div className="flex h-full items-center justify-between px-8">
        {/* Left - Title */}
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold text-text-primary tracking-tight">
            GPT Finance
          </h1>
          <span className="text-xs text-text-dimmed">Dashboard</span>
        </div>

        {/* Right - Controls */}
        <div className="flex items-center gap-4">
          {/* Date Range Selector */}
          <div className="flex items-center gap-1 rounded-lg border border-border-subtle bg-bg-surface p-0.5">
            {dateRangeOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setPreset(option.value)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  preset === option.value
                    ? 'bg-bg-elevated text-text-primary'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* Avatar y Logout */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleLogout}
              className="text-xs text-text-muted hover:text-text-primary transition-colors"
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
