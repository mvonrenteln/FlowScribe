/**
 * AI Server Settings
 *
 * Configuration UI for AI providers (Ollama, OpenAI, Custom).
 * Allows adding, editing, testing, and removing provider configurations.
 */

import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  Plus,
  Server,
  Trash2,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { createProvider, createProviderConfig, validateProviderConfig } from "@/lib/ai/providers";
import type { AIProviderConfig, AIProviderType } from "@/lib/ai/providers/types";
import {
  AI_CONCURRENCY_LIMITS,
  AI_REQUEST_TIMEOUT_LIMITS,
  addProviderToSettings,
  DEFAULT_AI_CONCURRENCY,
  DEFAULT_AI_REQUEST_TIMEOUT_SECONDS,
  getAIConcurrencySettings,
  getAIRequestTimeoutMs,
  initializeSettings,
  type PersistedSettings,
  removeProviderFromSettings,
  updateProviderInSettings,
  writeSettings,
} from "@/lib/settings/settingsStorage";
import { cn } from "@/lib/utils";

// ==================== Provider Form Component ====================

interface ProviderFormData {
  type: AIProviderType;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  availableModels: string[];
  isDefault: boolean;
}

const EMPTY_FORM: ProviderFormData = {
  type: "ollama",
  name: "",
  baseUrl: "http://localhost:11434",
  apiKey: "",
  model: "",
  availableModels: [],
  isDefault: false,
};

const PROVIDER_TYPE_OPTIONS: { value: AIProviderType; label: string }[] = [
  { value: "ollama", label: "Ollama (Local)" },
  { value: "openai", label: "OpenAI API" },
  { value: "custom", label: "Custom (OpenAI-compatible)" },
];

interface ProviderFormProps {
  initialData?: Partial<ProviderFormData>;
  onSave: (data: ProviderFormData) => void;
  onCancel: () => void;
  isEditing?: boolean;
}

function ProviderForm({ initialData, onSave, onCancel, isEditing }: ProviderFormProps) {
  const [form, setForm] = useState<ProviderFormData>({
    ...EMPTY_FORM,
    ...initialData,
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [manualModelInput, setManualModelInput] = useState("");

  const needsApiKey = form.type === "openai" || form.type === "custom";

  // Fetch available models from the provider API
  const handleFetchModels = async () => {
    setFetchingModels(true);
    setFetchError(null);
    try {
      const tempConfig = createProviderConfig({
        type: form.type,
        name: form.name || "temp",
        baseUrl: form.baseUrl,
        apiKey: form.apiKey || undefined,
        model: form.model || "temp",
      });
      const provider = createProvider(tempConfig);
      const models = await provider.listModels();
      setForm((prev) => ({
        ...prev,
        availableModels: models,
        // Auto-select first model if none selected
        model: prev.model || models[0] || "",
      }));
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to fetch models");
    } finally {
      setFetchingModels(false);
    }
  };

  // Add a model manually
  const handleAddManualModel = () => {
    const trimmed = manualModelInput.trim();
    if (trimmed && !form.availableModels.includes(trimmed)) {
      setForm((prev) => ({
        ...prev,
        availableModels: [...prev.availableModels, trimmed],
        model: prev.model || trimmed,
      }));
      setManualModelInput("");
    }
  };

  // Remove a model from the list
  const handleRemoveModel = (modelToRemove: string) => {
    setForm((prev) => ({
      ...prev,
      availableModels: prev.availableModels.filter((m) => m !== modelToRemove),
      model: prev.model === modelToRemove ? prev.availableModels[0] || "" : prev.model,
    }));
  };

  const handleTypeChange = (type: AIProviderType) => {
    const baseUrl =
      type === "ollama"
        ? "http://localhost:11434"
        : type === "openai"
          ? "https://api.openai.com/v1"
          : form.baseUrl;

    setForm((prev) => ({
      ...prev,
      type,
      baseUrl,
      apiKey: type === "ollama" ? "" : prev.apiKey,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validateProviderConfig({
      ...form,
      id: "temp",
    });

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors([]);
    onSave(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc pl-4">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="provider-type">Provider Type</Label>
          <Select value={form.type} onValueChange={handleTypeChange}>
            <SelectTrigger id="provider-type" data-testid="select-provider-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROVIDER_TYPE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="provider-name">Display Name</Label>
          <Input
            id="provider-name"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., Local Ollama, Production API"
            data-testid="input-provider-name"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="provider-url">Base URL</Label>
        <Input
          id="provider-url"
          type="url"
          value={form.baseUrl}
          onChange={(e) => setForm((prev) => ({ ...prev, baseUrl: e.target.value }))}
          placeholder="https://api.example.com/v1"
          data-testid="input-provider-url"
        />
      </div>

      {needsApiKey && (
        <div className="space-y-2">
          <Label htmlFor="provider-apikey">API Key</Label>
          <Input
            id="provider-apikey"
            type="password"
            value={form.apiKey}
            onChange={(e) => setForm((prev) => ({ ...prev, apiKey: e.target.value }))}
            placeholder="sk-..."
            autoComplete="off"
            data-testid="input-provider-apikey"
          />
          <p className="text-xs text-muted-foreground">
            The API key is stored locally in your browser and never sent to any server except the
            configured provider.
          </p>
        </div>
      )}

      {/* Models Management */}
      <div className="space-y-2">
        <Label>Models</Label>
        <div className="flex gap-2">
          <Input
            value={manualModelInput}
            onChange={(e) => setManualModelInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddManualModel();
              }
            }}
            placeholder="Add model manually..."
            className="flex-1"
            data-testid="input-manual-model"
          />
          <Button
            type="button"
            variant="outline"
            onClick={handleAddManualModel}
            disabled={!manualModelInput.trim()}
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleFetchModels}
            disabled={fetchingModels || !form.baseUrl}
            data-testid="button-fetch-models"
          >
            {fetchingModels ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            <span className="ml-1 hidden sm:inline">Fetch</span>
          </Button>
        </div>
        {fetchError && <p className="text-xs text-destructive">{fetchError}</p>}

        {form.availableModels.length > 0 ? (
          <div className="flex flex-wrap gap-1 mt-2">
            {form.availableModels.map((model) => (
              <Badge
                key={model}
                variant={model === form.model ? "default" : "secondary"}
                className="cursor-pointer group"
                onClick={() => setForm((prev) => ({ ...prev, model }))}
              >
                {model === form.model && "★ "}
                {model}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveModel(model);
                  }}
                  className="ml-1 opacity-60 hover:opacity-100"
                  aria-label={`Remove ${model}`}
                >
                  ×
                </button>
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-2">
            No models configured. Add manually or click "Fetch" to load from server.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Click a model to set it as default (★). Use "Fetch" to load models from the server.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Switch
            id="provider-default"
            checked={form.isDefault}
            onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isDefault: checked }))}
            data-testid="switch-provider-default"
          />
          <Label htmlFor="provider-default" className="cursor-pointer">
            Set as default provider
          </Label>
        </div>
      </div>

      <Separator />

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" data-testid="button-save-provider">
          {isEditing ? "Save Changes" : "Add Provider"}
        </Button>
      </div>
    </form>
  );
}

// ==================== Provider Card Component ====================

interface ProviderCardProps {
  provider: AIProviderConfig;
  onEdit: () => void;
  onDelete: () => void;
  onTest: () => Promise<boolean>;
  onSetDefault: () => void;
}

function ProviderCard({ provider, onEdit, onDelete, onTest, onSetDefault }: ProviderCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(
    provider.testStatus === "success"
      ? "success"
      : provider.testStatus === "error"
        ? "error"
        : null,
  );

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const success = await onTest();
      setTestResult(success ? "success" : "error");
    } catch {
      setTestResult("error");
    } finally {
      setTesting(false);
    }
  };

  const providerTypeLabel =
    PROVIDER_TYPE_OPTIONS.find((o) => o.value === provider.type)?.label ?? provider.type;

  return (
    <Card className={cn(provider.isDefault && "ring-2 ring-primary")}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                {provider.name}
                {provider.isDefault && (
                  <Badge variant="secondary" className="text-xs">
                    Default
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs">
                {providerTypeLabel} · {provider.model}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {testResult === "success" && (
              <Badge variant="outline" className="text-green-600 border-green-600">
                <Check className="h-3 w-3 mr-1" />
                Connected
              </Badge>
            )}
            {testResult === "error" && (
              <Badge variant="outline" className="text-destructive border-destructive">
                <AlertCircle className="h-3 w-3 mr-1" />
                Failed
              </Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setExpanded(!expanded)}
              aria-label={expanded ? "Collapse" : "Expand"}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-2 space-y-4">
          <div className="grid gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">URL:</span>
              <span className="font-mono text-xs">{provider.baseUrl}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Model:</span>
              <span className="font-mono text-xs">{provider.model}</span>
            </div>
            {provider.apiKey && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">API Key:</span>
                <span className="font-mono text-xs">••••••••{provider.apiKey.slice(-4)}</span>
              </div>
            )}
          </div>

          <Separator />

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleTest} disabled={testing}>
              {testing ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <Zap className="h-3 w-3 mr-1" />
                  Test Connection
                </>
              )}
            </Button>
            <Button variant="outline" size="sm" onClick={onEdit}>
              Edit
            </Button>
            {!provider.isDefault && (
              <Button variant="outline" size="sm" onClick={onSetDefault}>
                Set Default
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={onDelete}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Delete
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ==================== Main Component ====================

export function AIServerSettings() {
  const [settings, setSettings] = useState<PersistedSettings>(() => initializeSettings());
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Persist settings on change
  useEffect(() => {
    writeSettings(settings);
  }, [settings]);

  const concurrencySettings = getAIConcurrencySettings(settings);
  const effectiveTimeoutMs = getAIRequestTimeoutMs(settings);
  const effectiveTimeoutSeconds =
    effectiveTimeoutMs === 0 ? 0 : Math.round(effectiveTimeoutMs / 1000);

  const handleParseRetryCountChange = useCallback((value: number) => {
    setSettings((prev) => ({ ...prev, parseRetryCount: value }));
  }, []);

  const handleConcurrentRequestsChange = useCallback((enabled: boolean) => {
    setSettings((prev) => ({ ...prev, enableConcurrentRequests: enabled }));
  }, []);

  const handleConcurrentLimitChange = useCallback((value: number) => {
    setSettings((prev) => ({ ...prev, maxConcurrentRequests: value }));
  }, []);

  const handleRequestTimeoutChange = useCallback((value: number) => {
    setSettings((prev) => ({ ...prev, aiRequestTimeoutSeconds: value }));
  }, []);

  const handleAddProvider = useCallback((data: ProviderFormData) => {
    const newProvider = createProviderConfig({
      type: data.type,
      name: data.name,
      baseUrl: data.baseUrl,
      apiKey: data.apiKey || undefined,
      model: data.model,
      availableModels: data.availableModels,
      isDefault: data.isDefault,
    });

    setSettings((prev) => addProviderToSettings(prev, newProvider));
    setShowAddForm(false);
  }, []);

  const handleEditProvider = useCallback((id: string, data: ProviderFormData) => {
    setSettings((prev) =>
      updateProviderInSettings(prev, id, {
        type: data.type,
        name: data.name,
        baseUrl: data.baseUrl,
        apiKey: data.apiKey || undefined,
        model: data.model,
        availableModels: data.availableModels,
        isDefault: data.isDefault,
      }),
    );
    setEditingId(null);
  }, []);

  const handleDeleteProvider = useCallback((id: string) => {
    setSettings((prev) => removeProviderFromSettings(prev, id));
  }, []);

  const handleTestProvider = useCallback(async (provider: AIProviderConfig): Promise<boolean> => {
    try {
      const service = createProvider(provider);
      const success = await service.testConnection();

      // Update test status
      setSettings((prev) =>
        updateProviderInSettings(prev, provider.id, {
          testStatus: success ? "success" : "error",
          lastTested: Date.now(),
        }),
      );

      return success;
    } catch {
      setSettings((prev) =>
        updateProviderInSettings(prev, provider.id, {
          testStatus: "error",
          lastTested: Date.now(),
        }),
      );
      return false;
    }
  }, []);

  const handleSetDefault = useCallback((id: string) => {
    setSettings((prev) => ({
      ...prev,
      aiProviders: prev.aiProviders.map((p) => ({
        ...p,
        isDefault: p.id === id,
      })),
      defaultAIProviderId: id,
    }));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">AI Providers</h2>
        <p className="text-sm text-muted-foreground">
          Configure connections to AI services for speaker classification and other features.
        </p>
      </div>

      {/* Provider List */}
      <div className="space-y-3">
        {settings.aiProviders.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Server className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No AI providers configured yet.</p>
              <p className="text-sm">Add a provider to enable AI features.</p>
            </CardContent>
          </Card>
        ) : (
          settings.aiProviders.map((provider) =>
            editingId === provider.id ? (
              <Card key={provider.id}>
                <CardHeader>
                  <CardTitle className="text-base">Edit Provider</CardTitle>
                </CardHeader>
                <CardContent>
                  <ProviderForm
                    initialData={{
                      type: provider.type,
                      name: provider.name,
                      baseUrl: provider.baseUrl,
                      apiKey: provider.apiKey ?? "",
                      model: provider.model,
                      availableModels: provider.availableModels ?? [],
                      isDefault: provider.isDefault ?? false,
                    }}
                    onSave={(data) => handleEditProvider(provider.id, data)}
                    onCancel={() => setEditingId(null)}
                    isEditing
                  />
                </CardContent>
              </Card>
            ) : (
              <ProviderCard
                key={provider.id}
                provider={provider}
                onEdit={() => setEditingId(provider.id)}
                onDelete={() => handleDeleteProvider(provider.id)}
                onTest={() => handleTestProvider(provider)}
                onSetDefault={() => handleSetDefault(provider.id)}
              />
            ),
          )
        )}
      </div>

      {/* Add Provider Form */}
      {showAddForm ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add New Provider</CardTitle>
          </CardHeader>
          <CardContent>
            <ProviderForm onSave={handleAddProvider} onCancel={() => setShowAddForm(false)} />
          </CardContent>
        </Card>
      ) : (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setShowAddForm(true)}
          data-testid="button-add-provider"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Provider
        </Button>
      )}

      {/* Global AI Settings */}
      <Separator className="my-6" />

      <div className="space-y-4">
        <div>
          <h3 className="text-base font-medium">Global AI Settings</h3>
          <p className="text-sm text-muted-foreground">Settings that apply to all AI providers.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="parse-retry-count">Parse Retry Count</Label>
          <div className="flex items-center gap-4">
            <Input
              id="parse-retry-count"
              type="number"
              min={0}
              max={10}
              value={settings.parseRetryCount ?? 3}
              onChange={(e) => {
                const value = parseInt(e.target.value, 10);
                if (!Number.isNaN(value) && value >= 0 && value <= 10) {
                  handleParseRetryCountChange(value);
                }
              }}
              className="w-24"
              data-testid="input-parse-retry-count"
            />
            <span className="text-sm text-muted-foreground">(0-10)</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Number of retries when AI response cannot be parsed. Set to 0 to disable retries.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ai-request-timeout">Request Timeout (seconds)</Label>
          <div className="flex items-center gap-4">
            <Input
              id="ai-request-timeout"
              type="number"
              min={0}
              max={AI_REQUEST_TIMEOUT_LIMITS.max}
              value={
                settings.aiRequestTimeoutSeconds ??
                (effectiveTimeoutSeconds || DEFAULT_AI_REQUEST_TIMEOUT_SECONDS)
              }
              onChange={(e) => {
                const value = parseInt(e.target.value, 10);
                if (Number.isNaN(value)) return;
                if (
                  value === 0 ||
                  (value >= AI_REQUEST_TIMEOUT_LIMITS.min && value <= AI_REQUEST_TIMEOUT_LIMITS.max)
                ) {
                  handleRequestTimeoutChange(value);
                }
              }}
              className="w-24"
              data-testid="input-ai-request-timeout"
            />
            <span className="text-sm text-muted-foreground">
              (0 to disable, {AI_REQUEST_TIMEOUT_LIMITS.min}-{AI_REQUEST_TIMEOUT_LIMITS.max})
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Maximum time to wait for an AI request before timing out.
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="ai-parallel-requests"
              checked={concurrencySettings.enabled}
              onCheckedChange={(checked) => handleConcurrentRequestsChange(Boolean(checked))}
              data-testid="checkbox-ai-parallel-requests"
            />
            <Label htmlFor="ai-parallel-requests" className="cursor-pointer">
              Enable parallel AI requests
            </Label>
          </div>
          <p className="text-xs text-muted-foreground">
            Runs AI batch operations with limited concurrency. Keep disabled if your provider
            rate-limits aggressively.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ai-concurrency-limit">Max Concurrent Requests</Label>
          <div className="flex items-center gap-4">
            <Input
              id="ai-concurrency-limit"
              type="number"
              min={AI_CONCURRENCY_LIMITS.min}
              max={AI_CONCURRENCY_LIMITS.max}
              value={
                concurrencySettings.enabled
                  ? concurrencySettings.maxConcurrent
                  : DEFAULT_AI_CONCURRENCY.maxConcurrent
              }
              onChange={(e) => {
                const value = parseInt(e.target.value, 10);
                if (
                  !Number.isNaN(value) &&
                  value >= AI_CONCURRENCY_LIMITS.min &&
                  value <= AI_CONCURRENCY_LIMITS.max
                ) {
                  handleConcurrentLimitChange(value);
                }
              }}
              disabled={!concurrencySettings.enabled}
              className="w-24"
              data-testid="input-ai-concurrency-limit"
            />
            <span className="text-sm text-muted-foreground">
              ({AI_CONCURRENCY_LIMITS.min}-{AI_CONCURRENCY_LIMITS.max})
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Limits how many AI requests run in parallel when enabled.
          </p>
        </div>
      </div>
    </div>
  );
}
