import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

  useEffect(() => {
    if (open) {
      window.electron.getUserSettings().then((settings) => {
        setBaseUrl(settings.anthropicBaseUrl ?? "");
        setAuthToken(settings.anthropicAuthToken ?? "");
        setSaved(false);
        setValidationError(null);
      });
    }
  }, [open]);

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
            Configure your Anthropic API settings for Claude.
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
                  placeholder="sk-ant-..."
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
                Your Anthropic API key from{" "}
                <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                  console.anthropic.com
                </a>
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
              <strong>Note:</strong> Settings configured here take priority over environment variables.
              Changes apply to new sessions only.
            </p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
