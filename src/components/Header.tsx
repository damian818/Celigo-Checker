import React, { useState } from 'react';
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
  Loader2,
  ShieldCheck,
  Download,
  Bell,
  BellRing,
  Clock,
  CheckCircle2,
  Smartphone
} from 'lucide-react';
import type { User } from '../services/firebase';
import { GappifyLogo } from './GappifyLogo';

interface HeaderProps {
  activeTab: 'dashboard' | 'errors';
  setActiveTab: (tab: 'dashboard' | 'errors') => void;
  unresolvedCount: number;
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
  isInstallable?: boolean;
  isInstalled?: boolean;
  onInstallPWA?: () => void;
  autoSyncIntervalMinutes?: number;
  nextSyncCountdown?: string;
  notificationsEnabled?: boolean;
  notifyOnHealthySync?: boolean;
  onRequestNotificationPermission?: () => void;
  onTestNotification?: () => void;
  onToggleNotifyOnHealthySync?: () => void;
  onChangeAutoSyncInterval?: (minutes: number) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  unresolvedCount,
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
  onLogout,
  isInstallable = false,
  isInstalled = false,
  onInstallPWA,
  autoSyncIntervalMinutes = 30,
  nextSyncCountdown = '',
  notificationsEnabled = false,
  notifyOnHealthySync = true,
  onRequestNotificationPermission,
  onTestNotification,
  onToggleNotifyOnHealthySync,
  onChangeAutoSyncInterval
}) => {
  const [showSyncIntervalMenu, setShowSyncIntervalMenu] = useState(false);
  const [showNotificationMenu, setShowNotificationMenu] = useState(false);

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
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/50 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Celigo MCP Server: Online
          </div>

          {/* Prod Token Status */}
          <button
            onClick={onOpenTokensModal}
            className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-medium transition cursor-pointer hover:opacity-90 ${
              prodConnected 
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60' 
                : 'bg-slate-800/90 text-slate-400 border-slate-700 hover:border-slate-600'
            }`}
            title="Click to manage Production API Token"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${prodConnected ? 'bg-emerald-400' : 'bg-slate-500'}`}></span>
            <span>Production: {prodConnected ? 'Connected' : 'Token Required'}</span>
          </button>

          {/* Sandbox Token Status */}
          <button
            onClick={onOpenTokensModal}
            className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-medium transition cursor-pointer hover:opacity-90 ${
              sandboxConnected 
                ? 'bg-amber-950/60 text-amber-300 border-amber-800/60' 
                : 'bg-slate-800/90 text-slate-400 border-slate-700 hover:border-slate-600'
            }`}
            title="Click to manage Sandbox API Token"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${sandboxConnected ? 'bg-amber-400' : 'bg-slate-500'}`}></span>
            <span>Sandbox: {sandboxConnected ? 'Connected' : 'Token Required'}</span>
          </button>

          <div className="hidden lg:flex items-center gap-2 text-slate-400 ml-1">
            <span>integrator.io API v1</span>
            <span className="text-slate-600">•</span>
            <a 
              href="https://developer.celigo.com/mcp" 
              target="_blank" 
              rel="noreferrer" 
              className="text-sky-400 hover:text-sky-300 flex items-center gap-1 hover:underline"
            >
              MCP Docs <ExternalLink className="w-3 h-3" />
            </a>
            <span className="text-slate-600">•</span>
            <a 
              href="https://developer.celigo.com/cli" 
              target="_blank" 
              rel="noreferrer" 
              className="text-sky-400 hover:text-sky-300 flex items-center gap-1 hover:underline"
            >
              CLI Reference <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Notifications Permission & Settings Popover */}
          <div className="relative">
            <button
              onClick={() => setShowNotificationMenu(!showNotificationMenu)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition cursor-pointer ${
                notificationsEnabled
                  ? 'bg-sky-950/60 text-sky-300 border-sky-700/60 hover:bg-sky-900/60'
                  : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
              title="Configure browser desktop notifications & audio alerts"
            >
              {notificationsEnabled ? (
                <>
                  <BellRing className="w-3.5 h-3.5 text-sky-400" />
                  <span className="hidden sm:inline">Alerts Active</span>
                </>
              ) : (
                <>
                  <Bell className="w-3.5 h-3.5 text-slate-400" />
                  <span className="hidden sm:inline">Enable Alerts</span>
                </>
              )}
            </button>

            {showNotificationMenu && (
              <div className="absolute right-0 mt-1.5 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-[11px] font-bold text-slate-200 flex items-center gap-1.5">
                    <Bell className="w-3.5 h-3.5 text-sky-400" /> Notification Settings
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${notificationsEnabled ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60' : 'bg-slate-800 text-slate-400'}`}>
                    {notificationsEnabled ? 'Granted' : 'Pending'}
                  </span>
                </div>

                {!notificationsEnabled && (
                  <button
                    type="button"
                    onClick={() => {
                      onRequestNotificationPermission?.();
                      setShowNotificationMenu(false);
                    }}
                    className="w-full py-1.5 px-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <BellRing className="w-3.5 h-3.5" /> Request Browser Permission
                  </button>
                )}

                {/* Healthy Sync Notification Toggle */}
                <label className="flex items-start gap-2 text-xs text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={notifyOnHealthySync}
                    onChange={() => onToggleNotifyOnHealthySync?.()}
                    className="mt-0.5 rounded border-slate-700 bg-slate-950 text-sky-500 focus:ring-0 cursor-pointer"
                  />
                  <div>
                    <span className="font-medium text-slate-200 block text-[11px]">Notify on Healthy Syncs</span>
                    <span className="text-[10px] text-slate-400 block leading-snug">
                      Receive an alert when sync finishes even if 0 errors are found
                    </span>
                  </div>
                </label>

                {/* Test Notification Trigger */}
                <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
                  <button
                    type="button"
                    onClick={() => {
                      onTestNotification?.();
                    }}
                    className="w-full py-1 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 text-[11px] font-medium border border-slate-700 flex items-center justify-center gap-1 transition cursor-pointer"
                  >
                    🔔 Test Alert & Chime
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Auto-Sync Timer Badge & Interval Selector */}
          <div className="relative">
            <button
              onClick={() => setShowSyncIntervalMenu(!showSyncIntervalMenu)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium transition cursor-pointer"
              title="Click to adjust auto-sync frequency"
            >
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Auto-Sync: <strong className="text-white">{autoSyncIntervalMinutes}m</strong></span>
              {nextSyncCountdown && (
                <span className="text-[10px] text-emerald-400 font-mono hidden md:inline">({nextSyncCountdown})</span>
              )}
            </button>

            {showSyncIntervalMenu && (
              <div className="absolute right-0 mt-1.5 w-48 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95">
                <div className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                  Auto-Sync Frequency
                </div>
                {[5, 15, 30, 60].map((mins) => (
                  <button
                    key={mins}
                    onClick={() => {
                      onChangeAutoSyncInterval?.(mins);
                      setShowSyncIntervalMenu(false);
                    }}
                    className={`w-full px-3 py-1.5 text-left text-xs flex items-center justify-between hover:bg-slate-800 transition cursor-pointer ${
                      autoSyncIntervalMinutes === mins ? 'text-sky-400 font-bold bg-sky-950/30' : 'text-slate-300'
                    }`}
                  >
                    <span>Every {mins} minutes</span>
                    {autoSyncIntervalMinutes === mins && <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Sync Progress / Refresh Button */}
          {isSyncing ? (
            <button
              onClick={() => onShowSyncModal?.()}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-950/80 hover:bg-sky-900 text-sky-300 border border-sky-700/60 text-xs font-semibold shadow-sm transition cursor-pointer"
              title="Click to view full sync progress checklist"
            >
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-400" />
              <span className="hidden sm:inline">Syncing</span>
              <span className="font-mono text-[11px] text-sky-200 font-bold">{Math.round(syncProgress)}%</span>
            </button>
          ) : (
            <button
              onClick={() => onManualRefresh?.()}
              className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
              title="Refresh integration feeds & error queues immediately"
            >
              <RefreshCw className="w-3.5 h-3.5 text-sky-400" />
              <span>Refresh Feeds</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
        {/* Brand & Title */}
        <div className="flex items-center gap-3.5">
          <GappifyLogo size={42} />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-extrabold tracking-tight text-white flex items-center gap-2">
                Gappify <span className="font-semibold text-sky-400">Celigo Remediation Hub</span>
              </h1>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30 shadow-xs">
                AI Auto-Heal
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Automated Celigo integrator.io error analysis &amp; one-click self-healing workflows
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {user ? (
            <div className="flex items-center gap-2 mr-2">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-sky-950/40 border border-sky-500/30">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Avatar" className="w-5 h-5 rounded-full ring-1 ring-sky-400" />
                ) : (
                  <UserIcon className="w-4 h-4 text-sky-400" />
                )}
                <div className="flex flex-col text-left">
                  <span className="text-xs font-semibold text-sky-100 leading-tight">{user.displayName || user.email}</span>
                  <span className="text-[10px] text-emerald-400 font-mono">@gappify.com</span>
                </div>
              </div>
              <button
                onClick={onLogout}
                className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition cursor-pointer border border-transparent hover:border-slate-700"
                title="Log Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onLogin}
              disabled={isLoggingIn}
              className="mr-2 px-3.5 py-2 rounded-lg bg-sky-600/20 hover:bg-sky-600/40 text-sky-300 border border-sky-500/30 text-xs font-semibold flex items-center gap-2 transition cursor-pointer disabled:opacity-50 shadow-sm"
              title="Sign in with your @gappify.com Google Workspace account"
            >
              {isLoggingIn ? <Loader2 className="w-4 h-4 animate-spin text-sky-400" /> : <ShieldCheck className="w-4 h-4 text-sky-400" />}
              <span>Sign In with @gappify.com</span>
            </button>
          )}

          {/* PWA Install Button / Status */}
          {isInstalled ? (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700 text-[11px] font-medium text-slate-300">
              <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
              <span>App Installed</span>
            </div>
          ) : isInstallable ? (
            <button
              onClick={onInstallPWA}
              className="px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer animate-pulse"
              title="Install Gappify Celigo Remediation Hub as a Desktop / Mobile Web App"
            >
              <Download className="w-4 h-4" />
              <span>Install App</span>
            </button>
          ) : (
            <button
              onClick={onInstallPWA}
              className="hidden md:flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium transition cursor-pointer"
              title="Install as Progressive Web App"
            >
              <Download className="w-3.5 h-3.5 text-sky-400" />
              <span>Install App</span>
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
      </div>
    </header>
  );
};

