import { query, type SDKMessage, type PermissionResult, unstable_v2_prompt, type SDKResultMessage } from '@anthropic-ai/claude-agent-sdk';
import type { Session } from '../types.js';
import { recordMessage, updateSession, addPendingPermission } from './session.js';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync } from 'fs';

// Server event types
export type ServerEvent =
  | { type: 'session.status'; payload: { sessionId: string; status: string; title?: string; cwd?: string; error?: string } }
  | { type: 'stream.message'; payload: { sessionId: string; message: SDKMessage } }
  | { type: 'stream.user_prompt'; payload: { sessionId: string; prompt: string } }
  | { type: 'permission.request'; payload: { sessionId: string; toolUseId: string; toolName: string; input: unknown } }
  | { type: 'runner.error'; payload: { sessionId?: string; message: string } }
  | { type: 'session.list'; payload: { sessions: unknown[] } }
  | { type: 'session.history'; payload: { sessionId: string; status: string; messages: unknown[]; pendingPermissions: unknown[] } }
  | { type: 'session.deleted'; payload: { sessionId: string } };

// Runner options
export type RunnerOptions = {
  prompt: string;
  session: Session;
  resumeSessionId?: string;
  onSessionUpdate?: (updates: Partial<Session>) => void;
};

// Track active abort controllers
const activeControllers = new Map<string, AbortController>();

// Get Claude Code CLI path
function getClaudeCodePath(): string | undefined {
  // Check for bundled CLI first
  const bundledPath = process.env.CLAUDE_CLI_PATH;
  if (bundledPath && existsSync(bundledPath)) {
    return bundledPath;
  }

  // On Windows, don't return .cmd path - let SDK handle it via PATH
  // The SDK has issues spawning .cmd files directly
  if (process.platform === 'win32') {
    // Check if claude is in PATH by looking for the actual executable
    const npmPath = join(process.env.APPDATA || '', 'npm');
    const claudeJs = join(npmPath, 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js');
    if (existsSync(claudeJs)) {
      return claudeJs;
    }
    // Return undefined to let SDK find it via PATH
    return undefined;
  }

  // Check for system-installed Claude Code on Unix
  const systemPaths = [
    '/usr/local/bin/claude',
    '/opt/homebrew/bin/claude',
    join(homedir(), '.npm-global/bin/claude'),
  ];

  for (const p of systemPaths) {
    if (existsSync(p)) {
      return p;
    }
  }

  return undefined;
}

// Build enhanced environment
function getEnhancedEnv(): Record<string, string | undefined> {
  const home = homedir();
  
  let additionalPaths: string[];
  if (process.platform === 'win32') {
    additionalPaths = [
      join(process.env.APPDATA || '', 'npm'),
      join(process.env.LOCALAPPDATA || '', 'npm'),
      join(home, '.bun', 'bin'),
    ];
  } else {
    additionalPaths = [
      '/usr/local/bin',
      '/opt/homebrew/bin',
      `${home}/.bun/bin`,
      `${home}/.nvm/versions/node/v20.0.0/bin`,
      `${home}/.nvm/versions/node/v22.0.0/bin`,
      `${home}/.nvm/versions/node/v18.0.0/bin`,
      `${home}/.volta/bin`,
      `${home}/.fnm/aliases/default/bin`,
      '/usr/bin',
      '/bin',
    ];
  }

  // Add cli-bundle directory to PATH if CLAUDE_CLI_PATH is set
  const cliPath = process.env.CLAUDE_CLI_PATH;
  if (cliPath) {
    const cliBundleDir = join(cliPath, '..');
    if (existsSync(cliBundleDir)) {
      additionalPaths.unshift(cliBundleDir);
    }
  }

  const pathSeparator = process.platform === 'win32' ? ';' : ':';
  const currentPath = process.env.PATH || '';
  const newPath = [...additionalPaths, currentPath].join(pathSeparator);

  // Load Claude-specific env vars
  const claudeEnv: Record<string, string | undefined> = {};

  // Check for custom API settings from environment
  if (process.env.ANTHROPIC_API_KEY) {
    claudeEnv.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  }
  if (process.env.ANTHROPIC_BASE_URL) {
    claudeEnv.ANTHROPIC_BASE_URL = process.env.ANTHROPIC_BASE_URL;
  }
  if (process.env.ANTHROPIC_MODEL) {
    claudeEnv.ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL;
  }

  // Proxy settings
  if (process.env.PROXY_URL) {
    claudeEnv.HTTP_PROXY = process.env.PROXY_URL;
    claudeEnv.HTTPS_PROXY = process.env.PROXY_URL;
    claudeEnv.ALL_PROXY = process.env.PROXY_URL;
    claudeEnv.http_proxy = process.env.PROXY_URL;
    claudeEnv.https_proxy = process.env.PROXY_URL;
    claudeEnv.all_proxy = process.env.PROXY_URL;
  }

  return {
    ...process.env,
    ...claudeEnv,
    PATH: newPath,
  };
}

// Stop a session by ID (supports both internal and external IDs)
export function stopSession(sessionId: string): boolean {
  console.log('[Runner] Stopping session:', sessionId);
  console.log('[Runner] Active controllers:', Array.from(activeControllers.keys()));

  const controller = activeControllers.get(sessionId);
  if (controller) {
    console.log('[Runner] Found controller, aborting...');
    controller.abort();
    return true;
  }

  console.log('[Runner] No controller found for:', sessionId);
  return false;
}

// Run Claude query
export async function* runClaude(options: RunnerOptions): AsyncGenerator<ServerEvent> {
  const { prompt, session, resumeSessionId, onSessionUpdate } = options;
  const abortController = new AbortController();

  // Track this controller - use externalId if available for cross-process stop
  const trackingId = session.externalId || session.id;
  activeControllers.set(trackingId, abortController);
  console.log('[Runner] Tracking session with ID:', trackingId);

  const DEFAULT_CWD = process.cwd();

  // Queue for permission requests that need to be yielded
  const permissionRequestQueue: ServerEvent[] = [];

  // Get CLI path and environment dynamically (env vars are set after module load)
  const claudeCodePath = getClaudeCodePath();
  const enhancedEnv = getEnhancedEnv();

  console.log('[Runner] Starting Claude query:', { prompt: prompt.slice(0, 50), cwd: session.cwd ?? DEFAULT_CWD, resume: resumeSessionId });
  console.log('[Runner] Claude Code path:', claudeCodePath);

  try {
    const q = query({
      prompt,
      options: {
        cwd: session.cwd ?? DEFAULT_CWD,
        resume: resumeSessionId,
        abortController,
        env: enhancedEnv,
        pathToClaudeCodeExecutable: claudeCodePath,
        permissionMode: 'bypassPermissions',
        includePartialMessages: true,
        allowDangerouslySkipPermissions: true,
        settingSources: ['user', 'project', 'local'],
        canUseTool: async (toolName, input, { signal, toolUseID }) => {
          // For AskUserQuestion, we need to wait for user response
          if (toolName === 'AskUserQuestion') {
            const toolUseId = toolUseID;

            console.log('[Runner] AskUserQuestion requested, toolUseId:', toolUseId);

            // Queue permission request to be yielded
            permissionRequestQueue.push({
              type: 'permission.request',
              payload: { sessionId: session.id, toolUseId, toolName, input },
            });

            // Create a promise that will be resolved when user responds
            return new Promise<PermissionResult>((resolve) => {
              addPendingPermission(session.id, {
                toolUseId,
                toolName,
                input,
                resolve: (result) => {
                  console.log('[Runner] Permission resolved:', toolUseId, result.behavior);
                  resolve(result as PermissionResult);
                },
              });

              // Handle abort
              signal.addEventListener('abort', () => {
                resolve({ behavior: 'deny', message: 'Session aborted' });
              });
            });
          }

          // Auto-approve other tools
          return { behavior: 'allow', updatedInput: input };
        },
      },
    });

    console.log('[Runner] Query created, waiting for messages...');

    // Process messages
    for await (const message of q) {
      // Check if aborted before processing each message
      if (abortController.signal.aborted) {
        console.log('[Runner] Abort detected, stopping message processing');
        break;
      }

      console.log('[Runner] Received message:', message.type, 'subtype' in message ? (message as any).subtype : '');

      // Yield any queued permission requests first
      while (permissionRequestQueue.length > 0) {
        const permReq = permissionRequestQueue.shift();
        if (permReq) yield permReq;
      }

      // Check abort again after yielding permission requests
      if (abortController.signal.aborted) {
        console.log('[Runner] Abort detected after permission queue, stopping');
        break;
      }

      // Extract session_id from system init message
      if (message.type === 'system' && 'subtype' in message && message.subtype === 'init') {
        const sdkSessionId = (message as any).session_id;
        if (sdkSessionId) {
          session.claudeSessionId = sdkSessionId;
          onSessionUpdate?.({ claudeSessionId: sdkSessionId });
        }
      }

      // Check abort before yielding message
      if (abortController.signal.aborted) {
        console.log('[Runner] Abort detected before yielding message, stopping');
        break;
      }

      // Record message
      recordMessage(session.id, message);

      // Yield message event
      yield {
        type: 'stream.message',
        payload: { sessionId: session.id, message },
      };

      // Check abort after yielding
      if (abortController.signal.aborted) {
        console.log('[Runner] Abort detected after yielding message, stopping');
        break;
      }

      // Check for result to update session status
      if (message.type === 'result') {
        const status = (message as any).subtype === 'success' ? 'completed' : 'error';
        updateSession(session.id, { status });
        yield {
          type: 'session.status',
          payload: { sessionId: session.id, status, title: session.title },
        };
      }
    }

    // Check if aborted before marking as completed
    if (abortController.signal.aborted) {
      console.log('[Runner] Session aborted during processing');
      updateSession(session.id, { status: 'idle' });
      yield {
        type: 'session.status',
        payload: { sessionId: session.id, status: 'idle', title: session.title },
      };
      return;
    }

    // Query completed normally
    if (session.status === 'running') {
      updateSession(session.id, { status: 'completed' });
      yield {
        type: 'session.status',
        payload: { sessionId: session.id, status: 'completed', title: session.title },
      };
    }
  } catch (error) {
    console.error('[Runner] Error:', error);

    if ((error as Error).name === 'AbortError' || abortController.signal.aborted) {
      console.log('[Runner] Session aborted');
      updateSession(session.id, { status: 'idle' });
      yield {
        type: 'session.status',
        payload: {
          sessionId: session.id,
          status: 'idle',
          title: session.title,
        },
      };
      return;
    }

    updateSession(session.id, { status: 'error' });
    yield {
      type: 'session.status',
      payload: {
        sessionId: session.id,
        status: 'error',
        title: session.title,
        error: String(error),
      },
    };
  } finally {
    console.log('[Runner] Finished, cleaning up:', trackingId);

    // If aborted, ensure status is set to idle
    if (abortController.signal.aborted) {
      updateSession(session.id, { status: 'idle' });
    }

    // Clean up controller
    activeControllers.delete(trackingId);
  }
}

// Generate session title using Claude
export async function generateSessionTitle(userIntent: string | null): Promise<string> {
  if (!userIntent) return 'New Session';

  // Get CLI path and environment dynamically
  const claudeCodePath = getClaudeCodePath();
  const enhancedEnv = getEnhancedEnv();

  try {
    const result: SDKResultMessage = await unstable_v2_prompt(
      `please analyze the following user input to generate a short but clear title to identify this conversation theme:
      ${userIntent}
      directly output the title, do not include any other content`,
      {
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
        env: enhancedEnv,
        pathToClaudeCodeExecutable: claudeCodePath,
      }
    );

    if (result.subtype === 'success') {
      return result.result;
    }
  } catch (error) {
    console.error('Failed to generate session title:', error);
  }

  return 'New Session';
}
