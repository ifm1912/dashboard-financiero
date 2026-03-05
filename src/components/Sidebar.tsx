'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
type NavItem = {
  name: string;
  href: string;
};

const analyticsNav: NavItem[] = [
  { name: 'Overview', href: '/' },
  { name: 'Revenue', href: '/revenue' },
  { name: 'Recurring Revenue', href: '/contracts-forecast' },
  { name: 'Clients', href: '/customers' },
  { name: 'Cash Flow', href: '/cashflow' },
];

const operationsNav: NavItem[] = [
  { name: 'Contratos', href: '/contracts-summary' },
  { name: 'Facturas', href: '/invoices' },
  { name: 'RRHH', href: '/rrhh' },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Logo area */}
      <div className="flex h-14 items-center px-6 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-gradient-to-br from-accent to-accent-light flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-text-primary tracking-tight">GPT</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-6">
        <div className="space-y-1">
          {analyticsNav.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`block rounded-lg px-3 py-2 text-[13px] font-medium transition-all ${
                  isActive
                    ? 'bg-bg-elevated text-text-primary'
                    : 'text-text-muted hover:text-text-secondary hover:bg-bg-surface'
                }`}
              >
                {item.name}
              </Link>
            );
          })}
        </div>
        <div className="my-3 mx-3 border-t border-border-subtle" />
        <div className="space-y-1">
          {operationsNav.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`block rounded-lg px-3 py-2 text-[13px] font-medium transition-all ${
                  isActive
                    ? 'bg-bg-elevated text-text-primary'
                    : 'text-text-muted hover:text-text-secondary hover:bg-bg-surface'
                }`}
              >
                {item.name}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-border-subtle">
        <div className="px-3 py-2">
          <p className="text-[11px] text-text-dimmed">v2.0</p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar: always visible at lg+, hidden on mobile via static classes */}
      <aside className="hidden lg:block fixed left-0 top-0 z-50 h-screen w-52 border-r border-border-subtle bg-bg-base">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar: only rendered when open, hidden at lg+ */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
            onClick={onClose}
            aria-hidden="true"
          />
          <aside className="lg:hidden fixed left-0 top-0 z-50 h-screen w-52 border-r border-border-subtle bg-bg-base">
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  );
}
