import React from 'react';
import { ShieldCheck, Lock, ArrowRight, Zap, RefreshCw, Layers } from 'lucide-react';
import { GappifyLogo } from './GappifyLogo';
import { ALLOWED_DOMAIN } from '../services/firebase';

interface SignInPageProps {
  onLogin: () => void;
  isLoggingIn: boolean;
}

export const SignInPage: React.FC<SignInPageProps> = ({ onLogin, isLoggingIn }) => {
  return (
    <div className="min-h-screen bg-[#060B13] text-slate-100 flex flex-col justify-between selection:bg-sky-500 selection:text-white relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-sky-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Simple Brand Bar */}
      <header className="w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between border-b border-slate-800/60 relative z-10">
        <div className="flex items-center gap-3">
          <GappifyLogo size={42} />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-extrabold text-white tracking-tight">Gappify</span>
              <span className="text-xs px-2 py-0.5 rounded font-bold bg-sky-500/15 text-sky-400 border border-sky-500/30">
                Celigo Hub
              </span>
            </div>
            <p className="text-xs text-slate-400">Enterprise Integration Error Remediation</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900/80 px-3 py-1.5 rounded-full border border-slate-800">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Domain Restricted: <strong className="text-slate-200">@{ALLOWED_DOMAIN}</strong></span>
        </div>
      </header>

      {/* Hero / Sign In Card Section */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-12 flex flex-col items-center justify-center relative z-10">
        <div className="w-full max-w-xl bg-slate-900/90 border border-slate-800/90 rounded-3xl p-8 sm:p-10 shadow-2xl backdrop-blur-xl space-y-8 text-center relative">
          {/* Top Emblem */}
          <div className="flex justify-center">
            <div className="p-4 rounded-2xl bg-gradient-to-b from-sky-500/10 to-blue-600/5 border border-sky-500/20 shadow-inner">
              <GappifyLogo size={64} />
            </div>
          </div>

          {/* Heading */}
          <div className="space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-300 border border-sky-500/25">
              <Lock className="w-3.5 h-3.5 text-sky-400" />
              <span>Authentication Required</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Sign In to Remediation Hub
            </h1>
            <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
              Sign in with your verified <span className="text-slate-200 font-semibold">@{ALLOWED_DOMAIN}</span> corporate account to access integration health telemetry, diagnostic queues, and auto-healing workflows.
            </p>
          </div>

          {/* Action Button */}
          <div className="pt-2 flex flex-col items-center gap-3">
            <button
              id="gappify-google-signin-btn"
              onClick={onLogin}
              disabled={isLoggingIn}
              className="w-full sm:w-auto min-w-[280px] px-8 py-3.5 rounded-2xl bg-white hover:bg-slate-100 text-slate-950 font-bold text-sm flex items-center justify-center gap-3 shadow-xl hover:shadow-2xl transition-all active:scale-98 cursor-pointer disabled:opacity-50"
            >
              {isLoggingIn ? (
                <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              )}
              <span>{isLoggingIn ? 'Authenticating...' : 'Sign in with @gappify.com'}</span>
              {!isLoggingIn && <ArrowRight className="w-4 h-4 text-slate-500" />}
            </button>
            <p className="text-[11px] text-slate-500 font-medium">
              Strict access control • Only authorized Gappify domain accounts
            </p>
          </div>

          {/* Capability Highlights */}
          <div className="pt-6 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                <Zap className="w-3.5 h-3.5 text-sky-400" />
                <span>User Tokens</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Zero server-side token storage. Secured directly via your client session.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                <span>Auto-Remediation</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                AI diagnosis, plain-English root causes, and 1-click retry scripts.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                <span>Dual Sandbox</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Ingest Production &amp; Sandbox queues with multi-environment support.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-7xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500 border-t border-slate-800/60 relative z-10">
        <div>
          <span>&copy; {new Date().getFullYear()} Gappify Inc. All rights reserved.</span>
        </div>
        <div className="flex items-center gap-4">
          <span>Celigo integrator.io Partner Hub</span>
          <span>•</span>
          <span>SOC2 Type II Compliant</span>
        </div>
      </footer>
    </div>
  );
};
