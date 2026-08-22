import React from 'react';
import { 
  Activity, 
  Terminal, 
  Bot, 
  AlertTriangle, 
  PlusCircle, 
  Layers,
  ExternalLink,
  RefreshCw,
  Key,
  LogOut,
  User as UserIcon,
  Loader2
} from 'lucide-react';
import type { User } from '../services/firebase';

interface HeaderProps {
  activeTab: 'dashboard' | 'errors' | 'chat' | 'cli';
  setActiveTab: (tab: 'dashboard' | 'errors' | 'chat' | 'cli') => void;
  unresolvedCount: number;
  environment?: string;
  setEnvironment?: (env: string) => void;
  onOpenCustomAnalyzer: () => void;
  onOpenTokensModal: () => void;
  onManualRefresh?: () => void;
  prodConnected?: boolean;
  sandboxConnected?: boolean;
  isSyncing?: boolean;
  syncProgress?: number;
  syncStepMessage?: string;
  onShowSyncModal?: () => void;
  user?: User | null;
  isLoggingIn?: boolean;
  onLogin?: () => void;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  unresolvedCount,
  environment = 'Production',
  setEnvironment,
  onOpenCustomAnalyzer,
  onOpenTokensModal,
  onManualRefresh,
  prodConnected = false,
  sandboxConnected = false,
  isSyncing = false,
  syncProgress = 0,
  syncStepMessage = '',
  onShowSyncModal,
  user,
  isLoggingIn,
  onLogin,
  onLogout
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-md">
      {/* Topmost Linear Sync Progress Bar */}
      {isSyncing && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-slate-800 z-50 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 via-sky-400 to-emerald-400 transition-all duration-300 ease-out shadow-[0_0_10px_rgba(99,102,241,0.8)]"
            style={{ width: `${Math.max(8, Math.min(100, syncProgress))}%` }}
          />
        </div>
      )}

      {/* Top Utility Ribbon */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/50 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Celigo MCP Server: Online
          </div>

          {/* Prod Token Status */}
          <button
            onClick={onOpenTokensModal}
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-medium transition cursor-pointer hover:opacity-90 ${
              prodConnected 
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60' 
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
            title="Click to configure Production API Token"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${prodConnected ? 'bg-emerald-400' : 'bg-slate-500'}`}></span>
            <span>Prod: {prodConnected ? 'Connected' : 'Configure Token'}</span>
          </button>

          {/* Sandbox Token Status */}
          <button
            onClick={onOpenTokensModal}
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-medium transition cursor-pointer hover:opacity-90 ${
              sandboxConnected 
                ? 'bg-amber-950/60 text-amber-300 border-amber-800/60' 
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
            title="Click to configure Sandbox API Token"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${sandboxConnected ? 'bg-amber-400' : 'bg-slate-500'}`}></span>
            <span>Sandbox: {sandboxConnected ? 'Connected' : 'Configure Token'}</span>
          </button>

          <div className="hidden lg:flex items-center gap-2 text-slate-400">
            <span>integrator.io API v1</span>
            <span className="text-slate-600">•</span>
            <a 
              href="https://developer.celigo.com/mcp" 
              target="_blank" 
              rel="noreferrer" 
              className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 hover:underline"
            >
              MCP Docs <ExternalLink className="w-3 h-3" />
            </a>
            <span className="text-slate-600">•</span>
            <a 
              href="https://developer.celigo.com/cli" 
              target="_blank" 
              rel="noreferrer" 
              className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 hover:underline"
            >
              CLI Reference <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Configure Tokens Button */}
          <button
            onClick={onOpenTokensModal}
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
            title="Enter and manage your Celigo API Tokens"
          >
            <Key className="w-3.5 h-3.5 text-indigo-400" />
            <span>API Tokens</span>
          </button>

          {/* Environment Switcher */}
          <div className="flex items-center gap-1.5 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
            <span className="text-slate-400 text-xs">Env:</span>
            <select
              value={environment}
              onChange={(e) => setEnvironment?.(e.target.value)}
              className="bg-transparent text-slate-200 text-xs font-semibold focus:outline-none cursor-pointer"
            >
              <option value="Production" className="bg-slate-900 text-white">Production (US-West)</option>
              <option value="Sandbox" className="bg-slate-900 text-white">Sandbox (SB-1)</option>
              <option value="Staging" className="bg-slate-900 text-white">Staging (QA)</option>
            </select>
          </div>

          {/* Sync Progress / Refresh Button */}
          {isSyncing ? (
            <button
              onClick={() => onShowSyncModal?.()}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-700/60 text-xs font-semibold shadow-sm transition cursor-pointer"
              title="Click to view full sync progress checklist"
            >
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
              <span className="hidden sm:inline">Syncing</span>
              <span className="font-mono text-[11px] text-indigo-200 font-bold">{Math.round(syncProgress)}%</span>
            </button>
          ) : (
            <button
              onClick={() => onManualRefresh?.()}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer border border-transparent hover:border-slate-700"
              title="Refresh integration feeds & error queues"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
        {/* Brand & Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-500/25 border border-indigo-400/30">
            <Layers className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                Celigo Incident Hub
              </h1>
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                AI Remediation
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Plain-English error analysis & automated recovery for non-technical & IT teams
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {user ? (
            <div className="flex items-center gap-2 mr-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-950/40 border border-indigo-500/20">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Avatar" className="w-5 h-5 rounded-full" />
                ) : (
                  <UserIcon className="w-4 h-4 text-indigo-400" />
                )}
                <span className="text-xs font-medium text-indigo-100">{user.displayName || user.email}</span>
              </div>
              <button
                onClick={onLogout}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition cursor-pointer"
                title="Log Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onLogin}
              disabled={isLoggingIn}
              className="mr-2 px-3 py-2 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            >
              {isLoggingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserIcon className="w-4 h-4" />}
              Connect Workspace
            </button>
          )}

          <button
            onClick={onOpenTokensModal}
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Key className="w-4 h-4 text-indigo-400" />
            Set API Tokens
          </button>
          <button
            onClick={onOpenCustomAnalyzer}
            className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            Analyze Custom Error Log
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex overflow-x-auto gap-1 border-t border-slate-800/80">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`px-4 py-2.5 text-xs font-medium border-b-2 flex items-center gap-2 transition whitespace-nowrap cursor-pointer ${
            activeTab === 'dashboard'
              ? 'border-indigo-400 text-indigo-400 font-semibold bg-slate-800/30'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Activity className="w-4 h-4" />
          Live Health Dashboard
        </button>

        <button
          onClick={() => setActiveTab('errors')}
          className={`px-4 py-2.5 text-xs font-medium border-b-2 flex items-center gap-2 transition whitespace-nowrap cursor-pointer relative ${
            activeTab === 'errors'
              ? 'border-indigo-400 text-indigo-400 font-semibold bg-slate-800/30'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-rose-400" />
          Error Review & Remediation
          {unresolvedCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-500 text-white">
              {unresolvedCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('chat')}
          className={`px-4 py-2.5 text-xs font-medium border-b-2 flex items-center gap-2 transition whitespace-nowrap cursor-pointer ${
            activeTab === 'chat'
              ? 'border-indigo-400 text-indigo-400 font-semibold bg-slate-800/30'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Bot className="w-4 h-4 text-sky-400" />
          Celigo AI Copilot
        </button>

        <button
          onClick={() => setActiveTab('cli')}
          className={`px-4 py-2.5 text-xs font-medium border-b-2 flex items-center gap-2 transition whitespace-nowrap cursor-pointer ${
            activeTab === 'cli'
              ? 'border-indigo-400 text-indigo-400 font-semibold bg-slate-800/30'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Terminal className="w-4 h-4 text-emerald-400" />
          Celigo CLI & MCP Terminal
        </button>
      </div>
    </header>
  );
};

