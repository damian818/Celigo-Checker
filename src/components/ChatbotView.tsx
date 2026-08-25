import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  Bot, 
  Send, 
  Terminal, 
  Code, 
  Sparkles, 
  User, 
  Check, 
  Copy, 
  RefreshCw, 
  ArrowRight,
  HelpCircle,
  Zap,
  Loader2
} from 'lucide-react';
import { ChatMessage, CeligoErrorRecord, CeligoFlow } from '../types/celigo';
import { sendChatMessage } from '../services/apiClient';

interface ChatbotViewProps {
  errors: CeligoErrorRecord[];
  flows: CeligoFlow[];
  onRunCliCommand: (command: string) => void;
}

export const ChatbotView: React.FC<ChatbotViewProps> = ({
  errors,
  flows,
  onRunCliCommand,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg_welcome',
      role: 'assistant',
      content: `Hello! I am your **Celigo Copilot & Integration Support AI**, grounded in the Celigo MCP tools (https://developer.celigo.com/mcp), Celigo CLI (https://developer.celigo.com/cli), and integrator.io REST APIs.

I can help you:
1. **Translate obscure error codes** into plain English for business stakeholders.
2. **Generate executable Celigo CLI scripts** to batch-retry or inspect failed flows.
3. **Write JavaScript transformation hooks** (\`preSavePage\`, \`postMap\`) and Handlebars expressions.
4. **Formulate Jira troubleshooting checklists** for NetSuite, Salesforce, Shopify, and Workday.

What integration issue can I help troubleshoot today?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [inputPrompt, setInputPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(id);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleSend = async (userText: string) => {
    if (!userText.trim() || loading) return;

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: userText.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputPrompt('');
    setLoading(true);

    try {
      const activeErrorsSummary = errors.map(e => ({
        id: e.id,
        flow: e.flowName,
        record: e.recordIdentifier,
        code: e.rawErrorCode,
        summary: e.plainEnglishSummary,
        severity: e.severity
      }));

      const response = await sendChatMessage(
        messages.map((m) => ({ role: m.role, content: m.content })),
        userText.trim(),
        {
          activeErrors: activeErrorsSummary,
          flowsCount: flows.length,
          mcpConnected: true,
        }
      );

      const assistantMessage: ChatMessage = {
        id: `msg_${Date.now() + 1}`,
        role: 'assistant',
        content: response.text,
        cliCommandSnippet: response.cliCommandSnippet,
        scriptSnippet: response.scriptSnippet,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error('Chat error:', err);
      const errorMessage: ChatMessage = {
        id: `msg_err_${Date.now()}`,
        role: 'assistant',
        content: `I encountered an error connecting to the AI analysis engine. You can still run diagnostic CLI commands directly using \`celigo flows:list\` in the terminal.`,
        cliCommandSnippet: 'celigo flows:list',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const suggestedPrompts = [
    'How do I remediate NetSuite invoice INV-2026-9812 EU VAT missing error?',
    'Generate Celigo CLI command to retry all concurrency lock errors in Shopify',
    'Write a Celigo preSavePage hook to handle phone number formatting for Salesforce',
    'Explain how to configure auto-retry on HTTP 429 rate limits in integrator.io',
  ];

  return (
    <div className="h-[calc(100vh-12rem)] flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
      {/* Chat Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-850 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">
                Celigo AI Support Copilot
              </h3>
              <span className="px-2 py-0.2 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                MCP Agent Enabled
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Grounded in Celigo integrator.io APIs, Celigo CLI, and NetSuite/Salesforce ERP error schemas
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setMessages([messages[0]]);
          }}
          className="text-xs text-slate-400 hover:text-slate-200 px-2.5 py-1 rounded bg-slate-800 border border-slate-700 transition"
        >
          Clear Chat
        </button>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-5">
        {messages.map((msg, index) => {
          const isAssistant = msg.role === 'assistant';
          return (
            <div
              key={msg.id || index}
              className={`flex items-start gap-3 ${
                isAssistant ? 'justify-start' : 'justify-end'
              }`}
            >
              {isAssistant && (
                <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-2xl rounded-2xl p-4 text-xs leading-relaxed space-y-3 ${
                  isAssistant
                    ? 'bg-slate-800/80 border border-slate-700/80 text-slate-200 shadow-sm'
                    : 'bg-indigo-600 text-white shadow-md'
                }`}
              >
                {isAssistant ? (
                  <div className="space-y-2 prose prose-invert prose-xs max-w-none text-slate-200">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                        strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
                        em: ({ children }) => <em className="text-slate-300 italic">{children}</em>,
                        ul: ({ children }) => <ul className="list-disc list-inside space-y-1 my-2 ml-1 text-slate-300">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 my-2 ml-1 text-slate-300">{children}</ol>,
                        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                        code: ({ inline, className, children, ...props }: any) => {
                          return inline ? (
                            <code className="bg-slate-900 text-indigo-300 px-1.5 py-0.5 rounded font-mono text-[11px] border border-slate-700" {...props}>
                              {children}
                            </code>
                          ) : (
                            <pre className="bg-slate-950 border border-slate-800 text-emerald-400 p-3 rounded-xl font-mono text-[11px] my-2 overflow-x-auto whitespace-pre-wrap">
                              <code {...props}>{children}</code>
                            </pre>
                          );
                        },
                        a: ({ href, children }) => (
                          <a href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline font-medium inline-flex items-center gap-0.5">
                            {children}
                          </a>
                        ),
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap font-sans">
                    {msg.content}
                  </div>
                )}

                {/* Attached CLI snippet if present */}
                {msg.cliCommandSnippet && (
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] space-y-1.5">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <Terminal className="w-3 h-3" /> Executable Celigo CLI Command:
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleCopy(msg.cliCommandSnippet!, `cli_${index}`)}
                          className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] flex items-center gap-1"
                        >
                          {copiedIndex === `cli_${index}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          Copy
                        </button>
                        <button
                          onClick={() => onRunCliCommand(msg.cliCommandSnippet!)}
                          className="px-2 py-0.5 rounded bg-emerald-600/30 hover:bg-emerald-600/40 text-emerald-300 text-[10px] font-semibold border border-emerald-500/40 flex items-center gap-1"
                        >
                          <Terminal className="w-3 h-3" /> Execute
                        </button>
                      </div>
                    </div>
                    <div className="text-emerald-300 select-all overflow-x-auto">
                      {msg.cliCommandSnippet}
                    </div>
                  </div>
                )}

                {/* Attached JavaScript Script snippet if present */}
                {msg.scriptSnippet && (
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] space-y-1.5">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="text-sky-400 font-semibold flex items-center gap-1">
                        <Code className="w-3 h-3" /> Celigo Hook Snippet:
                      </span>
                      <button
                        onClick={() => handleCopy(msg.scriptSnippet!, `script_${index}`)}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] flex items-center gap-1"
                      >
                        {copiedIndex === `script_${index}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        Copy Script
                      </button>
                    </div>
                    <pre className="text-sky-200 max-h-48 overflow-y-auto whitespace-pre-wrap">
                      {msg.scriptSnippet}
                    </pre>
                  </div>
                )}

                <div className={`text-[10px] text-right ${isAssistant ? 'text-slate-400' : 'text-indigo-200'}`}>
                  {msg.timestamp}
                </div>
              </div>

              {!isAssistant && (
                <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0 mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {loading && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl px-4 py-3 text-xs text-slate-300 flex items-center gap-2 shadow-sm">
              <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
              <span>Analyzing Celigo MCP schemas and synthesizing remediation plan...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Prompt Chips */}
      <div className="px-4 py-2 bg-slate-850/80 border-t border-slate-800 flex overflow-x-auto gap-2 text-xs">
        <span className="text-[11px] text-slate-400 flex items-center gap-1 shrink-0">
          <Sparkles className="w-3 h-3 text-amber-400" /> Suggested:
        </span>
        {suggestedPrompts.map((prompt, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(prompt)}
            disabled={loading}
            className="px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[11px] whitespace-nowrap transition cursor-pointer disabled:opacity-50"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Input Box */}
      <div className="p-3 bg-slate-900 border-t border-slate-800">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(inputPrompt);
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            placeholder="Paste a Celigo error, ask how to map fields, or generate recovery CLI scripts..."
            disabled={loading}
            className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 font-medium"
          />
          <button
            type="submit"
            disabled={loading || !inputPrompt.trim()}
            className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
