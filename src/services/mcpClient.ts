import { McpToolDefinition } from '../server/mcpCeligoEngine';

export interface McpChatResponse {
  replyText: string;
  toolCallsExecuted: Array<{
    toolName: string;
    args: any;
    resultText: string;
    isError?: boolean;
  }>;
}

export async function fetchMcpToolCatalog(): Promise<McpToolDefinition[]> {
  try {
    const res = await fetch('/api/celigo/mcp/tools');
    if (!res.ok) throw new Error('Failed to fetch MCP tools');
    const data = await res.json();
    return data.tools || [];
  } catch (err) {
    console.warn('Failed to fetch MCP catalog from server:', err);
    return [];
  }
}

export async function executeMcpToolDirectly(
  toolName: string,
  toolArgs: Record<string, any>,
  contextData?: any
): Promise<{ text: string; structuredData?: any; isError?: boolean }> {
  const res = await fetch('/api/celigo/mcp/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      toolName,
      arguments: toolArgs,
      context: contextData,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'MCP tool execution failed');
  }

  const data = await res.json();
  return {
    text: data.content?.[0]?.text || 'No text output returned',
    structuredData: data.structuredData,
    isError: data.isError,
  };
}

export async function sendNaturalLanguageMcpPrompt(
  prompt: string,
  history: Array<{ role: string; content: string }>,
  contextData?: any
): Promise<McpChatResponse> {
  const res = await fetch('/api/celigo/mcp/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      history,
      context: contextData,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'MCP natural language prompt failed');
  }

  return res.json();
}
