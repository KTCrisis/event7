// Placement: frontend/src/components/settings/registry-form.tsx
"use client";

import { useState } from "react";
import { registriesApi } from "@/lib/api/registries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, ArrowLeft, Cloud, Server } from "lucide-react";
import { toast } from "sonner";
import type { ProviderType, AuthMode } from "@/types/registry";

interface RegistryFormProps {
  onSuccess: () => void;
  onBack?: () => void;
}

const PROVIDERS: { value: ProviderType; label: string; enabled: boolean }[] = [
  { value: "confluent", label: "Confluent Schema Registry", enabled: true },
  { value: "apicurio", label: "Apicurio Registry", enabled: true },
  { value: "karapace", label: "Karapace (Aiven)", enabled: true },
  { value: "redpanda", label: "Redpanda Schema Registry", enabled: true },
  { value: "glue", label: "AWS Glue (coming soon)", enabled: false },
];

const ENVIRONMENTS = ["DEV", "STAGING", "PPROD", "PROD"];

export function RegistryForm({ onSuccess, onBack }: RegistryFormProps) {
  const [name, setName] = useState("");
  const [providerType, setProviderType] = useState<ProviderType>("confluent");
  const [baseUrl, setBaseUrl] = useState("");
  const [authMode, setAuthMode] = useState<AuthMode>("api_key");

  // Cloud credentials
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");

  // Self-managed / Apicurio / Karapace / Redpanda credentials
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");

  const [environment, setEnvironment] = useState("DEV");
  const [loading, setLoading] = useState(false);

  const handleProviderChange = (newProvider: ProviderType) => {
    setProviderType(newProvider);
    // Reset auth mode + credentials when switching provider
    setAuthMode("api_key");
    setApiKey("");
    setApiSecret("");
    setUsername("");
    setPassword("");
    setToken("");
    setBaseUrl("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await registriesApi.create({
        name,
        provider_type: providerType,
        base_url: baseUrl,
        environment,
        // Confluent — credentials depend on auth mode
        ...(providerType === "confluent" && {
          auth_mode: authMode,
          ...(authMode === "api_key"
            ? { api_key: apiKey, api_secret: apiSecret }
            : {
                username: username || undefined,
                password: password || undefined,
              }),
        }),
        // Apicurio — optional credentials
        ...(providerType === "apicurio" && {
          ...(username && { username }),
          ...(password && { password }),
          ...(token && { token }),
        }),
        // Karapace / Redpanda — optional Basic Auth
        ...((providerType === "karapace" || providerType === "redpanda") && {
          ...(username && { username }),
          ...(password && { password }),
        }),
      });
      toast.success(`Registry "${name}" connected successfully`);
      onSuccess();
    } catch (err: any) {
      toast.error(err.detail || "Failed to connect registry");
    } finally {
      setLoading(false);
    }
  };

  // --- URL placeholder ---
  const urlPlaceholder =
    providerType === "confluent"
      ? authMode === "api_key"
        ? "https://psrc-xxxxx.europe-west9.gcp.confluent.cloud"
        : "https://schema-registry.internal:8081"
      : providerType === "apicurio"
        ? "http://apicurio:8080"
        : providerType === "karapace"
          ? "https://karapace-xxx.aivencloud.com:port"
          : providerType === "redpanda"
            ? "https://schema-registry.your-cluster.redpanda.com"
            : "https://...";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Back button (shown when inside stepper dialog) */}
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <ArrowLeft size={14} />
          Back to options
        </button>
      )}

      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          placeholder="e.g. Confluent PROD"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Provider</Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                {PROVIDERS.find((p) => p.value === providerType)?.label}
                <ChevronDown size={14} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {PROVIDERS.map((p) => (
                <DropdownMenuItem
                  key={p.value}
                  onClick={() => handleProviderChange(p.value)}
                  disabled={!p.enabled}
                >
                  {p.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="space-y-2">
          <Label>Environment</Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                {environment}
                <ChevronDown size={14} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {ENVIRONMENTS.map((env) => (
                <DropdownMenuItem
                  key={env}
                  onClick={() => setEnvironment(env)}
                >
                  {env}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Confluent — Deployment mode toggle */}
      {providerType === "confluent" && (
        <div className="space-y-2">
          <Label>Deployment Mode</Label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setAuthMode("api_key")}
              className={`flex items-center gap-2.5 rounded-lg border p-3 text-left transition-colors ${
                authMode === "api_key"
                  ? "border-cyan-500/60 bg-cyan-500/10 text-cyan-400"
                  : "border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-600"
              }`}
            >
              <Cloud size={16} className="shrink-0" />
              <div>
                <div className="text-sm font-medium">Cloud</div>
                <div className="text-[11px] text-zinc-500">API Key + Secret</div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setAuthMode("basic")}
              className={`flex items-center gap-2.5 rounded-lg border p-3 text-left transition-colors ${
                authMode === "basic"
                  ? "border-cyan-500/60 bg-cyan-500/10 text-cyan-400"
                  : "border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-600"
              }`}
            >
              <Server size={16} className="shrink-0" />
              <div>
                <div className="text-sm font-medium">Self-Managed</div>
                <div className="text-[11px] text-zinc-500">Username + Password</div>
              </div>
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="url">Schema Registry URL</Label>
        <Input
          id="url"
          placeholder={urlPlaceholder}
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          required
        />
      </div>

      {/* Confluent credentials — dynamic labels based on auth mode */}
      {providerType === "confluent" && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="cred-user">
              {authMode === "api_key" ? "API Key" : "Username"}
            </Label>
            <Input
              id="cred-user"
              placeholder={
                authMode === "api_key" ? "ABCD1234EFGH5678" : "ldap-username"
              }
              value={authMode === "api_key" ? apiKey : username}
              onChange={(e) =>
                authMode === "api_key"
                  ? setApiKey(e.target.value)
                  : setUsername(e.target.value)
              }
              required={authMode === "api_key"}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cred-pass">
              {authMode === "api_key" ? "API Secret" : "Password"}
            </Label>
            <Input
              id="cred-pass"
              type="password"
              placeholder="••••••••"
              value={authMode === "api_key" ? apiSecret : password}
              onChange={(e) =>
                authMode === "api_key"
                  ? setApiSecret(e.target.value)
                  : setPassword(e.target.value)
              }
              required={authMode === "api_key"}
            />
          </div>
          {authMode === "basic" && (
            <p className="col-span-2 text-xs text-zinc-500">
              Leave empty if your Schema Registry has no authentication configured.
            </p>
          )}
        </div>
      )}

      {/* Apicurio — optional credentials */}
      {providerType === "apicurio" && (
        <p className="text-xs text-zinc-500">
          No credentials needed — Apicurio will be accessed without
          authentication.
        </p>
      )}

      {/* Karapace / Redpanda — Basic Auth (optional) */}
      {(providerType === "karapace" || providerType === "redpanda") && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cred-user">Username</Label>
              <Input
                id="cred-user"
                placeholder={
                  providerType === "karapace"
                    ? "avnadmin"
                    : "redpanda-user"
                }
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cred-pass">Password</Label>
              <Input
                id="cred-pass"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-zinc-500">
            Leave empty if your{" "}
            {providerType === "karapace" ? "Karapace" : "Redpanda"} Schema
            Registry has no authentication configured.
          </p>
        </>
      )}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Testing connection..." : "Connect Registry"}
      </Button>
    </form>
  );
}