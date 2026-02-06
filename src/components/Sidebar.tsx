'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

type NavItem = {
  name: string;
  href: string;
};

type NavGroup = {
  name: string;
  children: NavItem[];
};

type NavigationItem = NavItem | NavGroup;

const navigation: NavigationItem[] = [
  {
    name: 'Overview',
    href: '/',
  },
  {
    name: 'Revenue Analytics',
    href: '/revenue-analytics',
  },
  {
    name: 'Contracts & Forecast',
    href: '/contracts-forecast',
  },
  {
    name: 'Cash Flow',
    href: '/cashflow',
  },
  {
    name: 'Facturas',
    href: '/invoices',
  },
];

function isNavGroup(item: NavigationItem): item is NavGroup {
  return 'children' in item;
}

export function Sidebar() {
  const pathname = usePathname();
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev =>
      prev.includes(groupName)
        ? prev.filter(name => name !== groupName)
        : [...prev, groupName]
    );
  };

  const isGroupActive = (group: NavGroup) => {
    return group.children.some(child => pathname === child.href);
  };

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-52 bg-bg-base">
      <div className="flex h-full flex-col">
        {/* Logo area - aligned with header */}
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
            {navigation.map((item) => {
              if (isNavGroup(item)) {
                const isExpanded = expandedGroups.includes(item.name);
                const groupActive = isGroupActive(item);

                return (
                  <div key={item.name}>
                    <button
                      onClick={() => toggleGroup(item.name)}
                      className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-[13px] font-medium transition-all ${
                        groupActive
                          ? 'text-text-primary'
                          : 'text-text-muted hover:text-text-secondary hover:bg-bg-surface'
                      }`}
                    >
                      <span>{item.name}</span>
                      <svg
                        className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {isExpanded && (
                      <div className="mt-1 ml-3 space-y-1 border-l border-border-subtle pl-3">
                        {item.children.map((child) => {
                          const isActive = pathname === child.href;
                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              className={`block rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all ${
                                isActive
                                  ? 'bg-bg-elevated text-text-primary'
                                  : 'text-text-muted hover:text-text-secondary hover:bg-bg-surface'
                              }`}
                            >
                              {child.name}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
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
    </aside>
  );
}
