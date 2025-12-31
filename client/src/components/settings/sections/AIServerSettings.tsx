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
import {
  type AIProviderConfig,
  type AIProviderType,
  createAIProvider,
  createProviderConfig,
  validateProviderConfig,
} from "@/lib/services/aiProviderService";
import {
  addProviderToSettings,
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
  isDefault: boolean;
}

const EMPTY_FORM: ProviderFormData = {
  type: "ollama",
  name: "",
  baseUrl: "http://localhost:11434",
  apiKey: "",
  model: "",
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

  const needsApiKey = form.type === "openai" || form.type === "custom";

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

      <div className="space-y-2">
        <Label htmlFor="provider-model">Model</Label>
        <Input
          id="provider-model"
          value={form.model}
          onChange={(e) => setForm((prev) => ({ ...prev, model: e.target.value }))}
          placeholder="e.g., llama3.2, gpt-4o, mistral"
          data-testid="input-provider-model"
        />
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

  const handleAddProvider = useCallback((data: ProviderFormData) => {
    const newProvider = createProviderConfig({
      type: data.type,
      name: data.name,
      baseUrl: data.baseUrl,
      apiKey: data.apiKey || undefined,
      model: data.model,
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
      const service = createAIProvider(provider);
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

      {/* Batch Size Setting */}
      <Separator />

      <div className="space-y-2">
        <Label htmlFor="batch-size">Batch Size</Label>
        <Input
          id="batch-size"
          type="number"
          min={1}
          max={50}
          value={settings.aiBatchSize}
          onChange={(e) =>
            setSettings((prev) => ({
              ...prev,
              aiBatchSize: Math.max(1, Math.min(50, Number.parseInt(e.target.value, 10) || 10)),
            }))
          }
          className="w-24"
          data-testid="input-batch-size"
        />
        <p className="text-xs text-muted-foreground">
          Number of segments to process per API request (1-50). Lower values may be more reliable
          but slower.
        </p>
      </div>
    </div>
  );
}
