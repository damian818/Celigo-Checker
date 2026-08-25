import React, { useState, useEffect, useRef } from 'react';
import { 
  Terminal, 
  Send, 
  Sparkles, 
  Cpu, 
  Play, 
  ChevronRight, 
  ChevronDown, 
  CheckCircle2, 
  AlertCircle, 
  Layers, 
  RefreshCw, 
  Code2, 
  HelpCircle, 
  Bot, 
  Zap, 
  Copy, 
  Check, 
  Compass, 
  ExternalLink 
} from 'lucide-react';
import { McpToolDefinition } from '../server/mcpCeligoEngine';
import { 
  fetchMcpToolCatalog, 
  executeMcpToolDirectly, 
  sendNaturalLanguageMcpPrompt, 
  McpChatResponse 
} from '../services/mcpClient';
import { CeligoErrorRecord, CeligoFlow, CeligoIntegration } from '../types/celigo';

interface McpConsoleViewProps {
  errors: CeligoErrorRecord[];
  flows: CeligoFlow[];
  integrations: CeligoIntegration[];
  tokens?: { prodToken?: string; sandboxToken?: string };
}

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  toolCallsExecuted?: Array<{
    toolName: string;
    args: any;
    resultText: string;
    isError?: boolean;
  }>;
}

export const McpConsoleView: React.FC<McpConsoleViewProps> = ({
  errors,
  flows,
  integrations,
  tokens,
}) => {
  const [tools, setTools] = useState<McpToolDefinition[]>([]);
  const [activeTab, setActiveTab] = useState<'assistant' | 'tools' | 'jsonrpc'>('assistant');
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      text: `👋 **Celigo Model Context Protocol (MCP) Assistant Ready**\n\nI am connected to your Celigo integrator.io environment through standard MCP tools. You can instruct me in natural language to:\n\n• **Diagnose & Inspect**: "Analyze all failing NetSuite invoices and suggest mapping fixes"\n• **Auto-Remediate**: "Retry all 429 rate-limited records across Sandbox and Production"\n• **Incident Tracking**: "Create linked Atlassian Jira tickets for all high-severity errors"\n• **Flow Health**: "Inspect health status and execution throughput of Shopify flows"`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [toolParamsJson, setToolParamsJson] = useState('{}');
  const [toolOutput, setToolOutput] = useState<string | null>(null);
  const [isExecutingTool, setIsExecutingTool] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load MCP tool catalog
  useEffect(() => {
    async function loadCatalog() {
      const catalog = await fetchMcpToolCatalog();
      setTools(catalog);
      if (catalog.length > 0 && !selectedTool) {
        setSelectedTool(catalog[0].name);
        setToolParamsJson(JSON.stringify(catalog[0].inputSchema.properties ? { flowId: 'flow_ns_sf_invoices' } : {}, null, 2));
      }
    }
    loadCatalog();
  }, []);

  // Scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendPrompt = async (textToSend?: string) => {
    const input = (textToSend || prompt).trim();
    if (!input || isProcessing) return;

    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      role: 'user',
      text: input,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setPrompt('');
    setIsProcessing(true);

    try {
      const chatHistory = messages.map((m) => ({ role: m.role, content: m.text }));
      const response = await sendNaturalLanguageMcpPrompt(input, chatHistory, {
        errors,
        flows,
        integrations,
        tokens,
      });

      const modelMsg: ChatMessage = {
        id: `mod_${Date.now()}`,
        role: 'model',
        text: response.replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        toolCallsExecuted: response.toolCallsExecuted,
      };

      setMessages((prev) => [...prev, modelMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err_${Date.now()}`,
        role: 'model',
        text: `⚠️ MCP Execution Notice: ${err.message || 'Could not complete MCP request.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExecuteSelectedTool = async () => {
    if (!selectedTool || isExecutingTool) return;
    setIsExecutingTool(true);
    setToolOutput(null);

    try {
      let parsedArgs = {};
      try {
        parsedArgs = JSON.parse(toolParamsJson);
      } catch {
        throw new Error('Invalid JSON in parameters field');
      }

      const result = await executeMcpToolDirectly(selectedTool, parsedArgs, {
        errors,
        flows,
        integrations,
        tokens,
      });

      setToolOutput(result.text);
    } catch (err: any) {
      setToolOutput(`Execution Error: ${err.message}`);
    } finally {
      setIsExecutingTool(false);
    }
  };

  const handleSelectTool = (toolName: string) => {
    setSelectedTool(toolName);
    const def = tools.find((t) => t.name === toolName);
    if (def) {
      const sample: Record<string, any> = {};
      if (def.inputSchema.properties) {
        Object.keys(def.inputSchema.properties).forEach((k) => {
          const prop = def.inputSchema.properties[k];
          if (prop.type === 'string') sample[k] = prop.enum ? prop.enum[0] : 'flow_sample_id';
          else if (prop.type === 'number') sample[k] = 20;
          else if (prop.type === 'boolean') sample[k] = true;
          else if (prop.type === 'array') sample[k] = ['err_1', 'err_2'];
        });
      }
      setToolParamsJson(JSON.stringify(sample, null, 2));
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const samplePrompts = [
    'List all active Celigo integrations across Sandbox and Production',
    'Diagnose all NetSuite invoice errors and suggest mapping fixes',
    'Retry all 429 rate limit errors with exponential backoff',
    'Get system health overview and MTTR stats',
    'Create linked Jira GS tickets for all open critical errors',
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                Celigo Model Context Protocol (MCP)
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-mono font-semibold border border-indigo-200">
                  v1.2.0 Spec
                </span>
              </h2>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Interact with Celigo integrator.io in natural language or execute standard MCP JSON-RPC 2.0 tools
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-medium">
          <button
            id="tab-mcp-assistant"
            onClick={() => setActiveTab('assistant')}
            className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ${
              activeTab === 'assistant'
                ? 'bg-white text-slate-900 font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Bot className="w-3.5 h-3.5 text-indigo-600" />
            MCP Natural Language
          </button>
          <button
            id="tab-mcp-tools"
            onClick={() => setActiveTab('tools')}
            className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ${
              activeTab === 'tools'
                ? 'bg-white text-slate-900 font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-emerald-600" />
            MCP Tool Catalog ({tools.length})
          </button>
          <button
            id="tab-mcp-jsonrpc"
            onClick={() => setActiveTab('jsonrpc')}
            className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ${
              activeTab === 'jsonrpc'
                ? 'bg-white text-slate-900 font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Code2 className="w-3.5 h-3.5 text-purple-600" />
            JSON-RPC 2.0 Endpoint
          </button>
        </div>
      </div>

      {/* View 1: Natural Language MCP Assistant */}
      {activeTab === 'assistant' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Chat Canvas */}
          <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200/80 shadow-xs flex flex-col h-[640px]">
            {/* Chat Messages */}
            <div className="flex-1 p-5 overflow-y-auto space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'model' && (
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 shadow-2xs">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] rounded-xl p-4 text-xs leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-indigo-600 text-white shadow-xs rounded-br-none'
                        : 'bg-slate-50 text-slate-800 border border-slate-200/70 shadow-2xs rounded-bl-none'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{msg.text}</div>

                    {/* Tool Execution Badges */}
                    {msg.toolCallsExecuted && msg.toolCallsExecuted.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-200/60 space-y-2">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                          <Zap className="w-3 h-3 text-amber-500" />
                          MCP Tools Executed:
                        </div>
                        {msg.toolCallsExecuted.map((tc, idx) => (
                          <div key={idx} className="bg-white p-2.5 rounded-lg border border-slate-200 text-[11px] font-mono text-slate-700 space-y-1">
                            <div className="flex items-center justify-between text-indigo-700 font-semibold">
                              <span>⚡ {tc.toolName}</span>
                              <span className="text-[10px] text-emerald-600 font-normal">Success</span>
                            </div>
                            <div className="text-slate-500 text-[10px] truncate">
                              Args: {JSON.stringify(tc.args)}
                            </div>
                            <div className="bg-slate-50 p-1.5 rounded text-[10px] text-slate-600 whitespace-pre-wrap max-h-24 overflow-y-auto">
                              {tc.resultText}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className={`text-[10px] mt-2 ${msg.role === 'user' ? 'text-indigo-200' : 'text-slate-400'}`}>
                      {msg.timestamp}
                    </div>
                  </div>

                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center flex-shrink-0 shadow-2xs text-xs font-bold">
                      YOU
                    </div>
                  )}
                </div>
              ))}

              {isProcessing && (
                <div className="flex items-center gap-2 text-xs text-slate-500 p-2">
                  <Bot className="w-4 h-4 text-indigo-600 animate-spin" />
                  <span>Celigo MCP Orchestrator evaluating tools and executing workflow...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <div className="p-4 bg-slate-50 border-t border-slate-200/80 rounded-b-xl">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendPrompt();
                }}
                className="flex items-center gap-2"
              >
                <input
                  id="input-mcp-prompt"
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Ask Celigo MCP in plain English (e.g. 'Retry all invoice errors in NetSuite flow')..."
                  className="flex-1 px-4 py-2.5 text-xs bg-white border border-slate-200 rounded-lg shadow-2xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  disabled={isProcessing}
                />
                <button
                  id="btn-send-mcp-prompt"
                  type="submit"
                  disabled={!prompt.trim() || isProcessing}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  Send
                </button>
              </form>
            </div>
          </div>

          {/* Quick MCP Prompt Suggestions & Environment Info */}
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Sample MCP Actions
              </h3>
              <div className="space-y-2">
                {samplePrompts.map((sp, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendPrompt(sp)}
                    className="w-full text-left p-2.5 rounded-lg text-xs bg-slate-50 hover:bg-indigo-50 hover:text-indigo-900 border border-slate-100 transition-colors flex items-start gap-2 text-slate-700"
                  >
                    <ChevronRight className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0 mt-0.5" />
                    <span>{sp}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">MCP Protocol Status</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Protocol:</span>
                  <span className="font-mono font-semibold text-slate-900">MCP 2024-11-05</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Server:</span>
                  <span className="font-mono text-slate-900">celigo-mcp v1.2</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Active Tools:</span>
                  <span className="font-semibold text-emerald-600">{tools.length} Loaded</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Transport:</span>
                  <span className="font-mono text-slate-900">HTTP JSON-RPC 2.0</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View 2: MCP Tool Catalog & Direct Test Console */}
      {activeTab === 'tools' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Tool List Sidebar */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-4 space-y-2 max-h-[640px] overflow-y-auto">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">10 Available Celigo MCP Tools</h3>
            {tools.map((t) => (
              <button
                key={t.name}
                onClick={() => handleSelectTool(t.name)}
                className={`w-full text-left p-3 rounded-lg text-xs transition-colors border ${
                  selectedTool === t.name
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-900 font-semibold shadow-2xs'
                    : 'bg-slate-50 border-slate-100 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="font-mono text-xs font-bold flex items-center justify-between">
                  <span>{t.name}</span>
                  <ChevronRight className="w-3 h-3 text-slate-400" />
                </div>
                <p className="text-[11px] text-slate-500 font-normal mt-1 line-clamp-2">{t.description}</p>
              </button>
            ))}
          </div>

          {/* Tool Details & Execution Runner */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/80 shadow-xs p-5 flex flex-col justify-between h-[640px]">
            {selectedTool ? (
              <div className="space-y-4 flex-1 overflow-y-auto">
                <div>
                  <h3 className="text-base font-bold font-mono text-indigo-700">{selectedTool}</h3>
                  <p className="text-xs text-slate-600 mt-1">
                    {tools.find((t) => t.name === selectedTool)?.description}
                  </p>
                </div>

                {/* Parameters Editor */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Input Parameters (JSON Schema)
                  </label>
                  <textarea
                    value={toolParamsJson}
                    onChange={(e) => setToolParamsJson(e.target.value)}
                    rows={6}
                    className="w-full p-3 font-mono text-xs bg-slate-900 text-emerald-400 rounded-lg focus:outline-hidden"
                  />
                </div>

                <button
                  id="btn-run-mcp-tool"
                  onClick={handleExecuteSelectedTool}
                  disabled={isExecutingTool}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <Play className={`w-3.5 h-3.5 ${isExecutingTool ? 'animate-spin' : ''}`} />
                  {isExecutingTool ? 'Executing MCP Tool...' : 'Execute Tool Call'}
                </button>

                {/* Output Console */}
                {toolOutput && (
                  <div className="mt-4">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Execution Output</label>
                    <pre className="p-4 rounded-lg bg-slate-900 text-slate-100 font-mono text-xs whitespace-pre-wrap max-h-60 overflow-y-auto">
                      {toolOutput}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-16 text-slate-400 text-xs">Select a tool from the catalog to inspect schema and test execution.</div>
            )}
          </div>
        </div>
      )}

      {/* View 3: JSON-RPC 2.0 Endpoint Documentation */}
      {activeTab === 'jsonrpc' && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-6 space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900">Standard MCP JSON-RPC 2.0 Interface</h3>
            <p className="text-xs text-slate-500 mt-1">
              External IDEs, Claude Desktop, Cursor, and custom agents can connect directly via POST to <code className="font-mono text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">/api/celigo/mcp</code>
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700">Sample Initialize Request:</span>
              <pre className="p-3 bg-slate-900 text-slate-100 font-mono text-xs rounded-lg overflow-x-auto">
{`curl -X POST https://your-app/api/celigo/mcp \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {}
    }
  }'`}
              </pre>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700">Sample Tool Call Request:</span>
              <pre className="p-3 bg-slate-900 text-slate-100 font-mono text-xs rounded-lg overflow-x-auto">
{`curl -X POST https://your-app/api/celigo/mcp \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "celigo_retry_errors",
      "arguments": {
        "flowId": "flow_ns_sf_invoices"
      }
    }
  }'`}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
