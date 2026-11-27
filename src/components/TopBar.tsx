import React, { useState } from 'react';
import { ArrowLeftRight, ChevronDown, LogOut } from 'lucide-react';
import { DEMO_USERS } from '../data/demoUsers';
import { DemoUser } from '../types/pharma';

export type WorkspaceTab = 'copilot' | 'telemetry' | 'ingestion';

interface TopBarProps {
  activeTab: WorkspaceTab;
  onChangeTab: (tab: WorkspaceTab) => void;
  currentUser: DemoUser;
  onSwitchUser: (user: DemoUser) => void;
  onSignOut: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onChangeTab,
  currentUser,
  onSwitchUser,
  onSignOut,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const navItems: { id: WorkspaceTab; label: string }[] = [
    { id: 'copilot', label: 'Defect Copilot' },
    { id: 'telemetry', label: 'Lines & Telemetry' },
    { id: 'ingestion', label: 'Ingestion & MES' },
  ];

  const otherUser = DEMO_USERS.find((u) => u.id !== currentUser.id) ?? DEMO_USERS[0];

  return (
    <header className="sticky top-0 z-30 glass-panel border-x-0 border-t-0">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-element Brand Wordmark */}
        <button
          type="button"
          onClick={() => onChangeTab('copilot')}
          className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0 cursor-pointer"
        >
          AetherPharma
        </button>

        {/* Zone 2: Concise single-line navigation links */}
        <nav className="flex items-center gap-6 overflow-x-auto">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChangeTab(item.id)}
                className={`relative py-2 text-sm font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  isActive
                    ? 'text-sky-600 dark:text-sky-400'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {item.label}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-sky-600 dark:bg-sky-400" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Clean User Profile Pill & Switch Role / Sign-Out */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            className="inline-flex items-center gap-2.5 pl-1.5 pr-3 py-1 rounded-full glass-surface-subtle hover:bg-white dark:hover:bg-slate-800/80 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <img
              src={currentUser.avatarPath}
              alt={currentUser.name}
              referrerPolicy="no-referrer"
              className="w-7 h-7 rounded-full object-cover"
            />
            <span className="text-xs font-medium text-slate-900 dark:text-white hidden sm:inline">
              {currentUser.name}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden md:inline">
              · {currentUser.role === 'operator' ? 'Operator' : 'QA Lead'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-72 rounded-2xl glass-panel p-3 shadow-xl z-50">
              <div className="pb-2.5 mb-2 border-b border-slate-200 dark:border-white/10">
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  {currentUser.name}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {currentUser.title} · {currentUser.employeeId}
                </div>
                <div className="text-[11px] text-sky-600 dark:text-sky-400 mt-1">
                  {currentUser.clearance}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  onSwitchUser(otherUser);
                  setMenuOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-sky-50 dark:hover:bg-sky-950/50 transition-colors cursor-pointer"
              >
                <ArrowLeftRight className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                <div className="min-w-0">
                  <div className="truncate">Switch to {otherUser.name}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {otherUser.title}
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onSignOut();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 mt-1 rounded-xl text-left text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span>Sign Out to Cleanroom Gate</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
