import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { execSync, spawn } from "child_process";
import { app } from "electron";
import { loadUserSettings } from "./user-settings.js";
import { claudeCodeEnv } from "./claude-settings.js";

export type InstallResult = {
  success: boolean;
  message: string;
  output?: string;
};

export type EnvironmentCheck = {
  id: string;
  name: string;
  status: "ok" | "warning" | "error" | "checking";
  message: string;
};

export type EnvironmentCheckResult = {
  checks: EnvironmentCheck[];
  allPassed: boolean;
};

/**
 * Check if Claude CLI is available
 */
function checkClaudeCLI(): EnvironmentCheck {
  try {
    // Try to run 'claude --version' or 'which claude'
    const result = execSync("which claude || where claude", {
      encoding: "utf8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    
    if (result.trim()) {
      return {
        id: "claude-cli",
        name: "Claude CLI",
        status: "ok",
        message: `Found at: ${result.trim().split("\n")[0]}`,
      };
    }
  } catch {
    // Try alternative check
    try {
      execSync("claude --version", {
        encoding: "utf8",
        timeout: 5000,
        stdio: ["pipe", "pipe", "pipe"],
      });
      return {
        id: "claude-cli",
        name: "Claude CLI",
        status: "ok",
        message: "Claude CLI is available",
      };
    } catch {
      // Not found
    }
  }

  return {
    id: "claude-cli",
    name: "Claude CLI",
    status: "warning",
    message: "Not found in PATH. Install with: npm install -g @anthropic-ai/claude-code",
  };
}

/**
 * Check if ~/.claude/settings.json exists
 */
function checkClaudeSettings(): EnvironmentCheck {
  const settingsPath = join(homedir(), ".claude", "settings.json");
  
  if (existsSync(settingsPath)) {
    return {
      id: "claude-settings",
      name: "Claude Settings File",
      status: "ok",
      message: `Found: ${settingsPath}`,
    };
  }

  return {
    id: "claude-settings",
    name: "Claude Settings File",
    status: "warning",
    message: "~/.claude/settings.json not found. You can configure API settings in this app.",
  };
}

/**
 * Check if API Token is configured
 */
function checkApiToken(): EnvironmentCheck {
  const userSettings = loadUserSettings();
  const hasUserToken = !!userSettings.anthropicAuthToken;
  const hasEnvToken = !!claudeCodeEnv.ANTHROPIC_AUTH_TOKEN;

  if (hasUserToken) {
    return {
      id: "api-token",
      name: "API Token",
      status: "ok",
      message: "Configured in app settings",
    };
  }

  if (hasEnvToken) {
    return {
      id: "api-token",
      name: "API Token",
      status: "ok",
      message: "Configured in ~/.claude/settings.json or environment",
    };
  }

  return {
    id: "api-token",
    name: "API Token",
    status: "error",
    message: "No API token configured. Please set it in Settings.",
  };
}

/**
 * Check if Base URL is configured (optional)
 */
function checkBaseUrl(): EnvironmentCheck {
  const userSettings = loadUserSettings();
  const hasUserBaseUrl = !!userSettings.anthropicBaseUrl;
  const hasEnvBaseUrl = !!claudeCodeEnv.ANTHROPIC_BASE_URL;

  if (hasUserBaseUrl) {
    return {
      id: "base-url",
      name: "API Base URL",
      status: "ok",
      message: `Custom: ${userSettings.anthropicBaseUrl}`,
    };
  }

  if (hasEnvBaseUrl) {
    return {
      id: "base-url",
      name: "API Base URL",
      status: "ok",
      message: `Custom: ${claudeCodeEnv.ANTHROPIC_BASE_URL}`,
    };
  }

  return {
    id: "base-url",
    name: "API Base URL",
    status: "ok",
    message: "Using default Anthropic API",
  };
}

/**
 * Check Node.js availability
 */
function checkNodeJs(): EnvironmentCheck {
  try {
    const version = process.version;
    const majorVersion = parseInt(version.slice(1).split(".")[0], 10);
    
    if (majorVersion >= 18) {
      return {
        id: "nodejs",
        name: "Node.js",
        status: "ok",
        message: `Version ${version}`,
      };
    }

    return {
      id: "nodejs",
      name: "Node.js",
      status: "warning",
      message: `Version ${version} (recommended: 18+)`,
    };
  } catch {
    return {
      id: "nodejs",
      name: "Node.js",
      status: "error",
      message: "Unable to detect Node.js version",
    };
  }
}

/**
 * Check SDK availability
 */
function checkSdk(): EnvironmentCheck {
  // Check if SDK exists in node_modules (works for both CJS and ESM)
  // Use app.getAppPath() for packaged app, process.cwd() for dev
  const appPath = app.isPackaged ? app.getAppPath() : process.cwd();
  
  const possiblePaths = [
    join(appPath, "node_modules", "@anthropic-ai", "claude-agent-sdk"),
    join(process.cwd(), "node_modules", "@anthropic-ai", "claude-agent-sdk"),
  ];
  
  for (const sdkPath of possiblePaths) {
    if (existsSync(sdkPath)) {
      // Try to read package.json to get version
      try {
        const pkgPath = join(sdkPath, "package.json");
        if (existsSync(pkgPath)) {
          const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
          return {
            id: "sdk",
            name: "Claude Agent SDK",
            status: "ok",
            message: `Installed (v${pkg.version})`,
          };
        }
      } catch {
        // Continue with basic check
      }
      
      return {
        id: "sdk",
        name: "Claude Agent SDK",
        status: "ok",
        message: "Installed and available",
      };
    }
  }
  
  return {
    id: "sdk",
    name: "Claude Agent SDK",
    status: "error",
    message: "SDK not found. Run: npm install @anthropic-ai/claude-agent-sdk",
  };
}

/**
 * Run all environment checks
 */
export async function runEnvironmentChecks(): Promise<EnvironmentCheckResult> {
  const checks: EnvironmentCheck[] = [
    checkNodeJs(),
    checkSdk(),
    checkClaudeCLI(),
    checkClaudeSettings(),
    checkApiToken(),
    checkBaseUrl(),
  ];

  const allPassed = checks.every(
    (check) => check.status === "ok" || check.status === "warning"
  );

  return {
    checks,
    allPassed,
  };
}

/**
 * Validate API configuration by making a test request
 */
export type ValidateApiResult = {
  valid: boolean;
  message: string;
};

export async function validateApiConfig(
  baseUrl?: string,
  authToken?: string
): Promise<ValidateApiResult> {
  const url = (baseUrl?.trim() || "https://api.anthropic.com").replace(/\/$/, "");
  const token = authToken?.trim() || claudeCodeEnv.ANTHROPIC_AUTH_TOKEN;

  if (!token) {
    return { valid: false, message: "API Token is required" };
  }

  try {
    const response = await fetch(`${url}/v1/messages`, {
      method: "POST",
      headers: {
        "x-api-key": token,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1,
        messages: [{ role: "user", content: "hi" }],
      }),
    });

    // 200 = success, 400 = bad request but auth passed
    if (response.ok || response.status === 400) {
      return { valid: true, message: "Connection successful" };
    }

    // 401/403 = auth failed
    if (response.status === 401 || response.status === 403) {
      return { valid: false, message: "Authentication failed: Invalid API token" };
    }

    // Other errors
    const errorText = await response.text().catch(() => "");
    return { valid: false, message: `API error (${response.status}): ${errorText.slice(0, 100)}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { valid: false, message: `Connection failed: ${message}` };
  }
}

/**
 * Install Claude CLI globally using npm
 */
export async function installClaudeCLI(
  onProgress?: (message: string) => void
): Promise<InstallResult> {
  return new Promise((resolve) => {
    onProgress?.("Starting installation...");
    
    // Build enhanced PATH to find npm/node
    const home = homedir();
    const additionalPaths = [
      "/usr/local/bin",
      "/opt/homebrew/bin",
      `${home}/.bun/bin`,
      `${home}/.nvm/versions/node/v20.0.0/bin`,
      `${home}/.nvm/versions/node/v22.0.0/bin`,
      `${home}/.nvm/versions/node/v18.0.0/bin`,
      `${home}/.volta/bin`,
      `${home}/.fnm/aliases/default/bin`,
      "/usr/bin",
      "/bin",
    ];
    const currentPath = process.env.PATH || "";
    const enhancedPath = [...additionalPaths, currentPath].join(":");

    // Try to find npm or bun
    let packageManager = "npm";
    try {
      execSync("which bun", { 
        encoding: "utf8", 
        env: { ...process.env, PATH: enhancedPath } 
      });
      packageManager = "bun";
    } catch {
      // Use npm
    }

    onProgress?.(`Using ${packageManager} to install...`);

    const installCmd = packageManager === "bun" 
      ? "bun" 
      : "npm";
    const installArgs = packageManager === "bun"
      ? ["install", "-g", "@anthropic-ai/claude-code"]
      : ["install", "-g", "@anthropic-ai/claude-code"];

    const child = spawn(installCmd, installArgs, {
      env: { ...process.env, PATH: enhancedPath },
      shell: true,
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data) => {
      const text = data.toString();
      stdout += text;
      onProgress?.(text.trim());
    });

    child.stderr?.on("data", (data) => {
      const text = data.toString();
      stderr += text;
      // Some npm output goes to stderr
      if (!text.includes("WARN")) {
        onProgress?.(text.trim());
      }
    });

    child.on("error", (error) => {
      resolve({
        success: false,
        message: `Failed to start installation: ${error.message}`,
        output: stderr,
      });
    });

    child.on("close", (code) => {
      if (code === 0) {
        onProgress?.("Installation completed successfully!");
        resolve({
          success: true,
          message: "Claude CLI installed successfully",
          output: stdout,
        });
      } else {
        resolve({
          success: false,
          message: `Installation failed with exit code ${code}`,
          output: stderr || stdout,
        });
      }
    });
  });
}

/**
 * Check if Claude CLI is installed (quick check)
 */
export function isClaudeCLIInstalled(): boolean {
  try {
    execSync("which claude || where claude 2>/dev/null", {
      encoding: "utf8",
      timeout: 3000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Install Node.js (via Homebrew on macOS, or provide download link)
 */
export async function installNodeJs(
  onProgress?: (message: string) => void
): Promise<InstallResult> {
  const platform = process.platform;
  
  if (platform === "darwin") {
    // macOS - try Homebrew first
    return new Promise((resolve) => {
      onProgress?.("Checking for Homebrew...");
      
      try {
        execSync("which brew", { encoding: "utf8", timeout: 3000 });
      } catch {
        resolve({
          success: false,
          message: "Homebrew not found. Please install Node.js manually from https://nodejs.org/",
        });
        return;
      }
      
      onProgress?.("Installing Node.js via Homebrew...");
      
      const child = spawn("brew", ["install", "node"], {
        shell: true,
      });
      
      let stdout = "";
      let stderr = "";
      
      child.stdout?.on("data", (data) => {
        const text = data.toString();
        stdout += text;
        onProgress?.(text.trim());
      });
      
      child.stderr?.on("data", (data) => {
        const text = data.toString();
        stderr += text;
        onProgress?.(text.trim());
      });
      
      child.on("error", (error) => {
        resolve({
          success: false,
          message: `Failed to install Node.js: ${error.message}`,
          output: stderr,
        });
      });
      
      child.on("close", (code) => {
        if (code === 0) {
          onProgress?.("Node.js installed successfully!");
          resolve({
            success: true,
            message: "Node.js installed successfully",
            output: stdout,
          });
        } else {
          resolve({
            success: false,
            message: `Installation failed with exit code ${code}`,
            output: stderr || stdout,
          });
        }
      });
    });
  } else if (platform === "win32") {
    // Windows - provide download link
    return {
      success: false,
      message: "Please download and install Node.js from https://nodejs.org/",
    };
  } else {
    // Linux - try apt or yum
    return new Promise((resolve) => {
      onProgress?.("Installing Node.js...");
      
      // Try apt first (Debian/Ubuntu)
      let cmd = "apt";
      let args = ["install", "-y", "nodejs", "npm"];
      
      try {
        execSync("which apt", { encoding: "utf8", timeout: 3000 });
      } catch {
        // Try yum (RHEL/CentOS)
        try {
          execSync("which yum", { encoding: "utf8", timeout: 3000 });
          cmd = "yum";
          args = ["install", "-y", "nodejs"];
        } catch {
          resolve({
            success: false,
            message: "Please install Node.js manually from https://nodejs.org/",
          });
          return;
        }
      }
      
      const child = spawn("sudo", [cmd, ...args], {
        shell: true,
      });
      
      let stdout = "";
      let stderr = "";
      
      child.stdout?.on("data", (data) => {
        const text = data.toString();
        stdout += text;
        onProgress?.(text.trim());
      });
      
      child.stderr?.on("data", (data) => {
        const text = data.toString();
        stderr += text;
        onProgress?.(text.trim());
      });
      
      child.on("close", (code) => {
        if (code === 0) {
          onProgress?.("Node.js installed successfully!");
          resolve({
            success: true,
            message: "Node.js installed successfully",
            output: stdout,
          });
        } else {
          resolve({
            success: false,
            message: `Installation failed. Please install manually from https://nodejs.org/`,
            output: stderr || stdout,
          });
        }
      });
    });
  }
}

/**
 * Install Claude Agent SDK
 */
export async function installSdk(
  onProgress?: (message: string) => void
): Promise<InstallResult> {
  return new Promise((resolve) => {
    onProgress?.("Installing Claude Agent SDK...");
    
    // Build enhanced PATH
    const home = homedir();
    const additionalPaths = [
      "/usr/local/bin",
      "/opt/homebrew/bin",
      `${home}/.bun/bin`,
      `${home}/.nvm/versions/node/v20.0.0/bin`,
      `${home}/.nvm/versions/node/v22.0.0/bin`,
      `${home}/.nvm/versions/node/v18.0.0/bin`,
      `${home}/.volta/bin`,
      `${home}/.fnm/aliases/default/bin`,
      "/usr/bin",
      "/bin",
    ];
    const currentPath = process.env.PATH || "";
    const enhancedPath = [...additionalPaths, currentPath].join(":");

    // Try to find npm or bun
    let packageManager = "npm";
    try {
      execSync("which bun", { 
        encoding: "utf8", 
        env: { ...process.env, PATH: enhancedPath } 
      });
      packageManager = "bun";
    } catch {
      // Use npm
    }

    onProgress?.(`Using ${packageManager} to install...`);

    // Install in app directory
    const appPath = app.isPackaged ? app.getAppPath() : process.cwd();
    
    const installArgs = packageManager === "bun"
      ? ["add", "@anthropic-ai/claude-agent-sdk"]
      : ["install", "@anthropic-ai/claude-agent-sdk"];

    const child = spawn(packageManager, installArgs, {
      cwd: appPath,
      env: { ...process.env, PATH: enhancedPath },
      shell: true,
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data) => {
      const text = data.toString();
      stdout += text;
      onProgress?.(text.trim());
    });

    child.stderr?.on("data", (data) => {
      const text = data.toString();
      stderr += text;
      if (!text.includes("WARN")) {
        onProgress?.(text.trim());
      }
    });

    child.on("error", (error) => {
      resolve({
        success: false,
        message: `Failed to install SDK: ${error.message}`,
        output: stderr,
      });
    });

    child.on("close", (code) => {
      if (code === 0) {
        onProgress?.("SDK installed successfully!");
        resolve({
          success: true,
          message: "Claude Agent SDK installed successfully",
          output: stdout,
        });
      } else {
        resolve({
          success: false,
          message: `Installation failed with exit code ${code}`,
          output: stderr || stdout,
        });
      }
    });
  });
}
