import React, { useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  KeyRound,
  Lock,
  Moon,
  ShieldCheck,
  Sun,
  UserCheck,
} from 'lucide-react';
import { DEMO_USERS } from '../data/demoUsers';
import { DemoUser } from '../types/pharma';

interface SignInScreenProps {
  onSelectUser: (user: DemoUser) => void;
  isDark: boolean;
  onToggleTheme: () => void;
}

export const SignInScreen: React.FC<SignInScreenProps> = ({
  onSelectUser,
  isDark,
  onToggleTheme,
}) => {
  const [employeeId, setEmployeeId] = useState('EMP-OP-1042');
  const [password, setPassword] = useState('••••••••••••');
  const [authError, setAuthError] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const matched = DEMO_USERS.find(
      (u) => u.employeeId.toLowerCase() === employeeId.trim().toLowerCase()
    );
    if (!password.trim()) {
      setAuthError('Enter your enterprise password or select an instant demo profile.');
      return;
    }
    setAuthError(null);
    onSelectUser(matched ?? DEMO_USERS[0]);
  };

  return (
    <div className="min-h-screen cleanroom-mesh-bg text-slate-900 dark:text-slate-100 flex flex-col justify-between p-4 sm:p-8">
      <div className="max-w-6xl w-full mx-auto flex items-center justify-between py-2">
        <div className="flex items-center gap-3">
          <span className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
            AetherPharma
          </span>
        </div>
        <button
          type="button"
          onClick={onToggleTheme}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium glass-surface-subtle text-slate-700 dark:text-slate-200 hover:bg-white/90 dark:hover:bg-slate-800/80 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-sky-600" />}
          <span>{isDark ? 'Cleanroom Light' : 'Midnight Slate'}</span>
        </button>
      </div>

      <main className="max-w-6xl w-full mx-auto my-auto py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left: Cleanroom Facility Showcase & Value Context */}
          <div className="lg:col-span-6 glass-panel rounded-[24px] overflow-hidden flex flex-col justify-between">
            <div className="relative h-64 sm:h-72 lg:h-80 w-full bg-slate-200 dark:bg-slate-900 overflow-hidden">
              {!imgError ? (
                <img
                  src="/src/assets/images/pharma_cleanroom_hero_1795760573651.jpg"
                  alt="Sterile GMP pharmaceutical cleanroom tablet compression and isolator suite"
                  referrerPolicy="no-referrer"
                  onError={() => setImgError(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-sky-900/40 to-slate-900 text-slate-300">
                  <ShieldCheck className="w-12 h-12 opacity-60" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent" />
              <div className="absolute bottom-5 left-6 right-6 text-white">
                <p className="text-xs font-medium text-sky-300 mb-1.5">
                  GMP Manufacturing Intelligence · 21 CFR Part 11 Aligned
                </p>
                <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight leading-tight text-balance">
                  Generative AI Quality Issue Explanation & Batch Deviation Copilot
                </h1>
              </div>
            </div>

            <div className="p-6 sm:p-8 flex flex-col justify-between gap-6 flex-1">
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                Correlate in-line quality inspection alerts, SCADA critical process parameters, LIMS assay context, and historical CAPA records into plain-language root causes and GMP-safe corrective sequences.
              </p>

              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-200/80 dark:border-white/10">
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Active Lines</div>
                  <div className="font-mono text-lg font-semibold text-slate-900 dark:text-white mt-0.5">
                    04 Suites
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Mean Resolution</div>
                  <div className="font-mono text-lg font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    19 min
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Formulation IP</div>
                  <div className="font-mono text-lg font-semibold text-sky-600 dark:text-sky-400 mt-0.5">
                    Masked
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Frosted Glass Sign-In & 1-Click Instant Demo Cards */}
          <div className="lg:col-span-6 glass-panel rounded-[24px] p-6 sm:p-8 flex flex-col justify-between gap-6">
            <div>
              <div className="flex items-center justify-between gap-3 mb-2">
                <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
                  Cleanroom Operator & QA Sign-In
                </h2>
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-600 dark:text-sky-400">
                  <BadgeCheck className="w-4 h-4" />
                  Enterprise SSO
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Choose a 1-click instant demo persona below or authenticate with your plant employee credentials.
              </p>
            </div>

            {/* 1-Click Instant Demo Login Cards */}
            <div className="space-y-3">
              <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
                1-Click Instant Demo Access
              </div>
              <div className="grid grid-cols-1 gap-3">
                {DEMO_USERS.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => onSelectUser(user)}
                    className="group w-full text-left p-4 rounded-[20px] glass-surface-subtle hover:bg-sky-50/90 dark:hover:bg-sky-950/40 border border-slate-200/80 dark:border-white/15 hover:border-sky-400/60 transition-all duration-150 flex items-center gap-4 cursor-pointer"
                  >
                    <img
                      src={user.avatarPath}
                      alt={user.name}
                      referrerPolicy="no-referrer"
                      className="w-12 h-12 rounded-2xl object-cover shrink-0 border border-white/30"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-display text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {user.title}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-sky-600 dark:text-sky-400 shrink-0 group-hover:translate-x-0.5 transition-transform">
                          Sign In
                          <ArrowRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                      <div className="text-xs text-slate-700 dark:text-slate-200 mt-0.5 truncate">
                        {user.name} · {user.assignedLine}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        {user.role === 'operator'
                          ? 'Unlocks plain-language defect explanations, fix checklists & operator feedback'
                          : 'Unlocks Cpk/Z-score CPP correlation, historical CAPA logs, sign-off & MES governance'}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="relative flex items-center py-1">
              <div className="flex-grow border-t border-slate-200 dark:border-white/10" />
              <span className="shrink mx-3 text-[11px] text-slate-400 dark:text-slate-500">
                Or sign in with Plant Directory
              </span>
              <div className="flex-grow border-t border-slate-200 dark:border-white/10" />
            </div>

            <form onSubmit={handleManualSubmit} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Employee ID
                  </label>
                  <div className="relative">
                    <UserCheck className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={employeeId}
                      onChange={(e) => setEmployeeId(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm rounded-xl bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-white/15 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500/50 font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Passcode / Smart Badge PIN
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm rounded-xl bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-white/15 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                    />
                  </div>
                </div>
              </div>

              {authError && (
                <p className="text-xs text-rose-600 dark:text-rose-400">{authError}</p>
              )}

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="submit"
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-sky-600 hover:bg-sky-500 text-white transition-colors cursor-pointer whitespace-nowrap"
                >
                  <KeyRound className="w-4 h-4" />
                  Authenticate via Plant SSO
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>

      <footer className="max-w-6xl w-full mx-auto text-center text-xs text-slate-500 dark:text-slate-400 py-2">
        AetherPharma Quality Operations · Validated Cleanroom Decision Support
      </footer>
    </div>
  );
};
