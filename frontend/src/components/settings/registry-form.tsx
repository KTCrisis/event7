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
import { ChevronDown, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import type { ProviderType } from "@/types/registry";

interface RegistryFormProps {
  onSuccess: () => void;
  onBack?: () => void;
}

const PROVIDERS: { value: ProviderType; label: string }[] = [
  { value: "confluent", label: "Confluent Cloud" },
  { value: "apicurio", label: "Apicurio (coming soon)" },
  { value: "glue", label: "AWS Glue (coming soon)" },
];

const ENVIRONMENTS = ["DEV", "STAGING", "PPROD", "PROD"];

export function RegistryForm({ onSuccess, onBack }: RegistryFormProps) {
  const [name, setName] = useState("");
  const [providerType, setProviderType] = useState<ProviderType>("confluent");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [environment, setEnvironment] = useState("DEV");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await registriesApi.create({
        name,
        provider_type: providerType,
        base_url: baseUrl,
        api_key: apiKey,
        api_secret: apiSecret,
        environment,
      });
      toast.success(`Registry "${name}" connected successfully`);
      onSuccess();
    } catch (err: any) {
      toast.error(err.detail || "Failed to connect registry");
    } finally {
      setLoading(false);
    }
  };

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
                  onClick={() => setProviderType(p.value)}
                  disabled={p.value !== "confluent"}
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

      <div className="space-y-2">
        <Label htmlFor="url">Schema Registry URL</Label>
        <Input
          id="url"
          placeholder="https://psrc-xxxxx.europe-west9.gcp.confluent.cloud"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="key">API Key</Label>
          <Input
            id="key"
            placeholder="API Key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="secret">API Secret</Label>
          <Input
            id="secret"
            type="password"
            placeholder="••••••••"
            value={apiSecret}
            onChange={(e) => setApiSecret(e.target.value)}
            required
          />
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Testing connection..." : "Connect Registry"}
      </Button>
    </form>
  );
}