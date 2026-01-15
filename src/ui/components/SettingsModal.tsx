import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Status icon component
function StatusIcon({ status }: { status: EnvironmentCheck["status"] }) {
  if (status === "checking") {
    return (
      <svg className="h-4 w-4 animate-spin text-muted" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.3" />
        <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (status === "ok") {
    return (
      <svg className="h-4 w-4 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    );
  }
  if (status === "warning") {
    return (
      <svg className="h-4 w-4 text-warning" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    );
  }
  return (
    <svg className="h-4 w-4 text-error" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const [baseUrl, setBaseUrl] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showToken, setShowToken] = useState(false);
  
  // Validation state
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  
  // Environment check state
  const [envChecks, setEnvChecks] = useState<EnvironmentCheck[]>([]);
  const [checking, setChecking] = useState(false);
  const [showChecks, setShowChecks] = useState(false);
  
  // Install CLI state
  const [installing, setInstalling] = useState(false);
  const [installProgress, setInstallProgress] = useState<string>("");
  const [installError, setInstallError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      window.electron.getUserSettings().then((settings) => {
        setBaseUrl(settings.anthropicBaseUrl ?? "");
        setAuthToken(settings.anthropicAuthToken ?? "");
        setSaved(false);
        setValidationError(null);
      });
      // Reset check state when opening
      setEnvChecks([]);
      setShowChecks(false);
      setInstallError(null);
      setInstallProgress("");
    }
  }, [open]);

  // Listen for install progress
  useEffect(() => {
    const unsubscribe = window.electron.onInstallProgress((message) => {
      setInstallProgress(message);
    });
    return unsubscribe;
  }, []);

  const handleCheckEnvironment = async () => {
    setChecking(true);
    setShowChecks(true);
    setInstallError(null);
    // Show checking state
    setEnvChecks([
      { id: "nodejs", name: "Node.js", status: "checking", message: "Checking..." },
      { id: "sdk", name: "Claude Agent SDK", status: "checking", message: "Checking..." },
      { id: "claude-cli", name: "Claude CLI", status: "checking", message: "Checking..." },
      { id: "claude-settings", name: "Claude Settings File", status: "checking", message: "Checking..." },
      { id: "api-token", name: "API Token", status: "checking", message: "Checking..." },
      { id: "base-url", name: "API Base URL", status: "checking", message: "Checking..." },
    ]);
    
    try {
      const result = await window.electron.checkEnvironment();
      setEnvChecks(result.checks);
    } catch (error) {
      console.error("Environment check failed:", error);
    } finally {
      setChecking(false);
    }
  };

  // Generic install handler
  const handleInstall = async (type: "cli" | "nodejs" | "sdk") => {
    setInstalling(true);
    setInstallError(null);
    setInstallProgress("Starting installation...");
    
    try {
      let result: InstallResult;
      
      switch (type) {
        case "cli":
          result = await window.electron.installClaudeCLI();
          break;
        case "nodejs":
          result = await window.electron.installNodeJs();
          break;
        case "sdk":
          result = await window.electron.installSdk();
          break;
      }
      
      if (result.success) {
        setInstallProgress("Installation completed!");
        // Re-run environment check after successful installation
        setTimeout(() => {
          handleCheckEnvironment();
        }, 1000);
      } else {
        setInstallError(result.message);
        setInstallProgress("");
      }
    } catch (error) {
      setInstallError("Installation failed: " + (error instanceof Error ? error.message : String(error)));
      setInstallProgress("");
    } finally {
      setInstalling(false);
    }
  };

  const handleSave = async () => {
    setValidationError(null);
    
    // If we have custom settings, validate them first
    const hasCustomConfig = baseUrl.trim() || authToken.trim();
    
    if (hasCustomConfig) {
      setValidating(true);
      try {
        const result = await window.electron.validateApiConfig(
          baseUrl.trim() || undefined,
          authToken.trim() || undefined
        );
        
        if (!result.valid) {
          setValidationError(result.message);
          setValidating(false);
          return;
        }
      } catch (error) {
        setValidationError("Validation failed: " + (error instanceof Error ? error.message : String(error)));
        setValidating(false);
        return;
      }
      setValidating(false);
    }
    
    // Validation passed, save settings
    setSaving(true);
    try {
      await window.electron.saveUserSettings({
        anthropicBaseUrl: baseUrl.trim() || undefined,
        anthropicAuthToken: authToken.trim() || undefined,
      });
      setSaved(true);
      setTimeout(() => {
        onOpenChange(false);
      }, 1000);
    } catch (error) {
      console.error("Failed to save settings:", error);
      setValidationError("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setBaseUrl("");
    setAuthToken("");
    await window.electron.saveUserSettings({});
    setSaved(true);
  };

  const hasChanges = baseUrl.trim() !== "" || authToken.trim() !== "";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink-900/20 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg max-h-[85vh] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-ink-900/5 bg-surface p-6 shadow-elevated overflow-y-auto">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-base font-semibold text-ink-800">
              API Settings
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                className="rounded-full p-1.5 text-muted hover:bg-surface-tertiary hover:text-ink-700 transition-colors"
                aria-label="Close"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </Dialog.Close>
          </div>

          <p className="mt-2 text-sm text-muted">
            Configure custom API settings. Leave empty to use{" "}
            <code className="rounded bg-surface-tertiary px-1.5 py-0.5 text-xs font-mono">
              ~/.claude/settings.json
            </code>
          </p>

          <div className="mt-5 grid gap-4">
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-muted">Base URL</span>
              <input
                type="url"
                className="rounded-xl border border-ink-900/10 bg-surface-secondary px-4 py-2.5 text-sm text-ink-800 placeholder:text-muted-light focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20 transition-colors"
                placeholder="https://api.anthropic.com (optional)"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
              />
              <span className="text-[11px] text-muted-light">
                Custom API endpoint for third-party compatible services
              </span>
            </label>

            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-muted">API Token</span>
              <div className="relative">
                <input
                  type={showToken ? "text" : "password"}
                  className="w-full rounded-xl border border-ink-900/10 bg-surface-secondary px-4 py-2.5 pr-12 text-sm text-ink-800 placeholder:text-muted-light focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20 transition-colors font-mono"
                  placeholder="sk-ant-... (optional)"
                  value={authToken}
                  onChange={(e) => setAuthToken(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-muted hover:text-ink-700 transition-colors"
                  aria-label={showToken ? "Hide token" : "Show token"}
                >
                  {showToken ? (
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
              <span className="text-[11px] text-muted-light">
                Your Anthropic API key or compatible service token
              </span>
            </label>

            {/* Validation Error */}
            {validationError && (
              <div className="rounded-xl border border-error/20 bg-error/5 p-3">
                <p className="text-xs text-error flex items-start gap-2">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                  <span>{validationError}</span>
                </p>
              </div>
            )}

            <div className="mt-2 flex gap-3">
              {hasChanges && (
                <button
                  type="button"
                  onClick={handleClear}
                  disabled={validating || saving}
                  className="rounded-xl border border-ink-900/10 bg-surface px-4 py-2.5 text-sm text-muted hover:bg-surface-tertiary hover:text-ink-700 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Clear All
                </button>
              )}
              <button
                type="button"
                onClick={handleSave}
                disabled={validating || saving}
                className="flex-1 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white shadow-soft hover:bg-accent-hover transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              >
                {validating ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg aria-hidden="true" className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    Validating...
                  </span>
                ) : saving ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg aria-hidden="true" className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    Saving...
                  </span>
                ) : saved ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12l4 4L19 6" />
                    </svg>
                    Saved
                  </span>
                ) : (
                  "Save Settings"
                )}
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-info/20 bg-info/5 p-3">
            <p className="text-xs text-info">
              <strong>Note:</strong> Settings configured here take priority over{" "}
              <code className="rounded bg-info/10 px-1 py-0.5 font-mono">~/.claude/settings.json</code>.
              Changes apply to new sessions only.
            </p>
          </div>

          {/* Environment Check Section */}
          <div className="mt-5 border-t border-ink-900/10 pt-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-ink-800">Environment Check</span>
              <button
                type="button"
                onClick={handleCheckEnvironment}
                disabled={checking}
                className="rounded-lg border border-ink-900/10 bg-surface px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-surface-tertiary transition-colors disabled:opacity-50"
              >
                {checking ? "Checking..." : "Run Check"}
              </button>
            </div>

            {showChecks && (
              <div className="mt-3 rounded-xl border border-ink-900/10 bg-surface-secondary overflow-hidden">
                {envChecks.map((check, index) => (
                  <div
                    key={check.id}
                    className={`flex items-start gap-3 px-4 py-3 ${
                      index !== envChecks.length - 1 ? "border-b border-ink-900/5" : ""
                    }`}
                  >
                    <div className="mt-0.5 flex-shrink-0">
                      <StatusIcon status={check.status} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-ink-800">{check.name}</div>
                      <div className={`text-xs mt-0.5 ${
                        check.status === "error" ? "text-error" : 
                        check.status === "warning" ? "text-warning" : 
                        "text-muted"
                      }`}>
                        {check.message}
                      </div>
                      {/* Show install button for items that can be installed */}
                      {(check.status === "warning" || check.status === "error") && (
                        <>
                          {check.id === "claude-cli" && (
                            <button
                              type="button"
                              onClick={() => handleInstall("cli")}
                              disabled={installing}
                              className="mt-2 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {installing ? (
                                <span className="flex items-center gap-1.5">
                                  <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                  </svg>
                                  Installing...
                                </span>
                              ) : (
                                "Install Claude CLI"
                              )}
                            </button>
                          )}
                          {check.id === "nodejs" && (
                            <button
                              type="button"
                              onClick={() => handleInstall("nodejs")}
                              disabled={installing}
                              className="mt-2 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {installing ? (
                                <span className="flex items-center gap-1.5">
                                  <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                  </svg>
                                  Installing...
                                </span>
                              ) : (
                                "Install Node.js"
                              )}
                            </button>
                          )}
                          {check.id === "sdk" && (
                            <button
                              type="button"
                              onClick={() => handleInstall("sdk")}
                              disabled={installing}
                              className="mt-2 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {installing ? (
                                <span className="flex items-center gap-1.5">
                                  <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                  </svg>
                                  Installing...
                                </span>
                              ) : (
                                "Install SDK"
                              )}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Install progress */}
            {installProgress && (
              <div className="mt-3 rounded-xl border border-info/20 bg-info/5 p-3">
                <p className="text-xs text-info font-mono">{installProgress}</p>
              </div>
            )}

            {/* Install error */}
            {installError && (
              <div className="mt-3 rounded-xl border border-error/20 bg-error/5 p-3">
                <p className="text-xs text-error">{installError}</p>
              </div>
            )}

            {showChecks && !checking && (
              <div className="mt-3 text-xs text-muted">
                {envChecks.every(c => c.status === "ok") ? (
                  <span className="text-success">✓ All checks passed</span>
                ) : envChecks.some(c => c.status === "error") ? (
                  <span className="text-error">✗ Some checks failed. Please fix the issues above.</span>
                ) : (
                  <span className="text-warning">⚠ Some warnings. The app may still work.</span>
                )}
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
