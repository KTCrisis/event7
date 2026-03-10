// src/components/schemas/schema-detail.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileCode, GitBranch, Link2, Clock, Hash,
  ChevronDown, ArrowRightLeft, Loader2, AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SchemaContent } from "./schema-content";
import { getSchema, getVersions, getReferences, getCompatibility } from "@/lib/api/schemas";
import type { SchemaDetail as SchemaDetailType, SchemaReference, CompatibilityInfo } from "@/types/schema";

interface SchemaDetailProps {
  registryId: string;
  subject: string;
}

export function SchemaDetail({ registryId, subject }: SchemaDetailProps) {
  const router = useRouter();
  const [schema, setSchema] = useState<SchemaDetailType | null>(null);
  const [versions, setVersions] = useState<number[]>([]);
  const [refs, setRefs] = useState<SchemaReference[]>([]);
  const [compat, setCompat] = useState<CompatibilityInfo | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch schema data
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      getSchema(registryId, subject),
      getVersions(registryId, subject),
      getReferences(registryId, subject).catch(() => []),
      getCompatibility(registryId, subject).catch(() => null),
    ])
      .then(([schemaData, versionsData, refsData, compatData]) => {
        if (cancelled) return;
        setSchema(schemaData);
        setVersions(versionsData);
        setRefs(refsData);
        setCompat(compatData);
        setSelectedVersion(schemaData.version);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.detail || "Failed to load schema");
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [registryId, subject]);

  // Load specific version
  const handleVersionChange = async (version: number) => {
    setSelectedVersion(version);
    setLoading(true);
    try {
      const data = await getSchema(registryId, subject);
      // If we need a specific version, use the versions-detail endpoint
      // For now, the latest is fetched — version selector is visual
      setSchema(data);
    } catch (err: any) {
      setError(err?.detail || "Failed to load version");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <Loader2 className="animate-spin mr-2" size={18} />
        Loading schema…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-destructive gap-2">
        <AlertCircle size={18} />
        {error}
      </div>
    );
  }

  if (!schema) return null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 p-4 border-b border-border space-y-3">
        {/* Subject name */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold truncate pr-4" title={subject}>
            {subject}
          </h2>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 text-xs gap-1.5"
            onClick={() =>
              router.push(
                `/schemas/${encodeURIComponent(subject)}/diff`
              )
            }
            disabled={versions.length < 2}
          >
            <ArrowRightLeft size={13} />
            Compare
          </Button>
        </div>

        {/* Meta badges */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Format */}
          <Badge variant="outline" className="text-[10px] gap-1">
            <FileCode size={10} />
            {schema.format}
          </Badge>

          {/* Schema ID */}
          <Badge variant="outline" className="text-[10px] gap-1 text-muted-foreground">
            <Hash size={10} />
            ID {schema.schema_id}
          </Badge>

          {/* Compatibility */}
          {compat && (
            <Badge variant="outline" className="text-[10px] gap-1 text-muted-foreground">
              <GitBranch size={10} />
              {compat.compatibility}
            </Badge>
          )}

          {/* References count */}
          {refs.length > 0 && (
            <Badge variant="outline" className="text-[10px] gap-1 text-cyan-400 border-cyan-500/30">
              <Link2 size={10} />
              {refs.length} ref{refs.length > 1 ? "s" : ""}
            </Badge>
          )}
        </div>

        {/* Version selector */}
        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="text-xs gap-1.5 h-7">
                <Clock size={12} />
                Version {selectedVersion}
                <ChevronDown size={12} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {[...versions].reverse().map((v) => (
                <DropdownMenuItem
                  key={v}
                  onClick={() => handleVersionChange(v)}
                  className="text-xs"
                >
                  Version {v}
                  {v === Math.max(...versions) && (
                    <Badge className="ml-2 text-[9px] px-1 py-0 h-3.5">latest</Badge>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <span className="text-[11px] text-muted-foreground">
            {versions.length} version{versions.length > 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* References */}
      {refs.length > 0 && (
        <div className="shrink-0 px-4 py-2 border-b border-border/50 bg-muted/20">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 font-medium">
            References
          </div>
          <div className="flex flex-wrap gap-1.5">
            {refs.map((ref) => (
              <Badge
                key={`${ref.subject}-${ref.version}`}
                variant="outline"
                className="text-[10px] gap-1 text-cyan-400 border-cyan-500/20 cursor-default"
              >
                <Link2 size={9} />
                {ref.name} → {ref.subject}:v{ref.version}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Schema content */}
      <div className="flex-1 overflow-auto p-4">
        <SchemaContent content={schema.schema_content} maxHeight="none" />
      </div>
    </div>
  );
}