import React, { useState, useRef, useEffect } from 'react';
import { 
  Terminal, 
  Play, 
  Trash2, 
  Copy, 
  Check, 
  HelpCircle, 
  ExternalLink,
  Zap,
  Layers,
  ArrowRight,
  Loader2
} from 'lucide-react';
import { executeCliCommand } from '../services/apiClient';

interface CliTerminalViewProps {
  initialCommand?: string;
}

interface CliHistoryEntry {
  command: string;
  output: string;
  status: 'success' | 'warning' | 'error';
  timestamp: string;
}

export const CliTerminalView: React.FC<CliTerminalViewProps> = ({
  initialCommand,
}) => {
  const [commandInput, setCommandInput] = useState(initialCommand || 'celigo flows:list');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<CliHistoryEntry[]>([
    {
      command: 'celigo --version',
      output: `@celigo/cli/2.8.4 linux-x64 node-v22.14.0\nCeligo MCP Protocol: v1.4.2\nAPI Endpoint: https://api.integrator.io/v1`,
      status: 'success',
      timestamp: '07:00:00',
    },
    {
      command: 'celigo auth:status',
      output: `✓ Logged in as: Damian (Gappify)\n✓ Environment: Production (US-West)\n✓ Token Status: Active (Expires in 42 days)`,
      status: 'success',
      timestamp: '07:00:01',
    },
  ]);

  const terminalEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialCommand) {
      setCommandInput(initialCommand);
      handleExecute(initialCommand);
    }
  }, [initialCommand]);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, loading]);

  const handleExecute = async (cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed || loading) return;

    if (trimmed === 'clear' || trimmed === 'cls') {
      setHistory([]);
      setCommandInput('');
      return;
    }

    setLoading(true);
    try {
      const res = await executeCliCommand(trimmed);
      setHistory((prev) => [
        ...prev,
        {
          command: trimmed,
          output: res.output,
          status: res.status,
          timestamp: res.timestamp,
        },
      ]);
      setCommandInput('');
    } catch (err: any) {
      setHistory((prev) => [
        ...prev,
        {
          command: trimmed,
          output: `Error executing command: ${err.message || 'Unknown network error'}`,
          status: 'error',
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleCopyAll = () => {
    const text = history.map(h => `$ ${h.command}\n${h.output}`).join('\n\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const quickCommands = [
    'celigo flows:list',
    'celigo flows:retry-errors --flowId flow_ns_sf_invoices',
    'celigo connections:test --id conn_workday_hr',
    'celigo mcp:inspect',
    'celigo errors:export',
    'celigo --help',
  ];

  return (
    <div className="space-y-4 pb-12">
      {/* Header Info */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Terminal className="w-5 h-5 text-emerald-400" />
              Celigo CLI & MCP Terminal Emulator
            </h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Interactive
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Execute real-time Celigo CLI commands (<a href="https://developer.celigo.com/cli" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline inline-flex items-center gap-0.5">celigo-cli docs <ExternalLink className="w-3 h-3" /></a>) and MCP agent diagnostic tools.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyAll}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            Copy Console
          </button>
          <button
            onClick={() => setHistory([])}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </button>
        </div>
      </div>

      {/* Suggested Quick Commands */}
      <div className="flex overflow-x-auto gap-2 text-xs py-1">
        <span className="text-[11px] text-slate-400 flex items-center gap-1 shrink-0">
          Quick Commands:
        </span>
        {quickCommands.map((cmd, idx) => (
          <button
            key={idx}
            onClick={() => {
              setCommandInput(cmd);
              handleExecute(cmd);
            }}
            disabled={loading}
            className="px-2.5 py-1 rounded-md bg-slate-850 hover:bg-slate-800 text-emerald-400 hover:text-emerald-300 font-mono text-[11px] border border-slate-800 whitespace-nowrap transition cursor-pointer"
          >
            $ {cmd}
          </button>
        ))}
      </div>

      {/* Terminal Screen */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-2xl font-mono text-xs text-slate-200 min-h-[480px] max-h-[640px] overflow-y-auto flex flex-col justify-between">
        {/* Logs */}
        <div className="space-y-4">
          <div className="text-slate-500 pb-2 border-b border-slate-900 flex items-center justify-between text-[11px]">
            <span>Celigo CLI Shell • Connected to https://api.integrator.io</span>
            <span>Type &quot;celigo --help&quot; for full manual</span>
          </div>

          {history.map((entry, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                <span className="text-indigo-400">celigo@gappify-prod:~$</span>
                <span>{entry.command}</span>
                <span className="text-[10px] text-slate-600 ml-auto font-sans">{entry.timestamp}</span>
              </div>
              <pre
                className={`p-3 rounded-lg bg-slate-900/90 whitespace-pre-wrap leading-relaxed overflow-x-auto ${
                  entry.status === 'error'
                    ? 'text-rose-300 border border-rose-900/40 bg-rose-950/20'
                    : entry.status === 'warning'
                    ? 'text-amber-300 border border-amber-900/40 bg-amber-950/20'
                    : 'text-slate-300 border border-slate-850'
                }`}
              >
                {entry.output}
              </pre>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-emerald-400">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
              <span className="text-slate-400">Executing command against integrator.io API...</span>
            </div>
          )}

          <div ref={terminalEndRef} />
        </div>

        {/* Command Input Prompt */}
        <div className="pt-4 border-t border-slate-900 mt-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleExecute(commandInput);
            }}
            className="flex items-center gap-2 bg-slate-900/80 px-3 py-2 rounded-xl border border-slate-800"
          >
            <span className="text-emerald-400 font-bold select-none">$</span>
            <input
              ref={inputRef}
              type="text"
              value={commandInput}
              onChange={(e) => setCommandInput(e.target.value)}
              placeholder="e.g. celigo flows:retry-errors --flowId flow_ns_sf_invoices"
              disabled={loading}
              className="flex-1 bg-transparent text-white font-mono text-xs focus:outline-none placeholder-slate-600"
              autoFocus
            />
            <button
              type="submit"
              disabled={loading || !commandInput.trim()}
              className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs flex items-center gap-1 transition disabled:opacity-40 cursor-pointer"
            >
              <Play className="w-3 h-3 fill-slate-950" />
              Run
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
