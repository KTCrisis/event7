// src/components/catalog/enrichment-editor.tsx
"use client";

import { useState } from "react";
import { X, Save, Loader2, Plus, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { updateEnrichment } from "@/lib/api/governance";
import { DataLayerBadge } from "@/components/catalog/data-layer-badge";
import type { CatalogEntry, DataClassification, DataLayer } from "@/types/governance";
import { toast } from "sonner";

interface EnrichmentEditorProps {
  registryId: string;
  entry: CatalogEntry;
  onClose: () => void;
  onSaved: (updated: CatalogEntry) => void;
}

const CLASSIFICATIONS: { value: DataClassification; label: string; color: string }[] = [
  { value: "public", label: "Public", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  { value: "internal", label: "Internal", color: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  { value: "confidential", label: "Confidential", color: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
  { value: "restricted", label: "Restricted", color: "bg-red-500/10 text-red-400 border-red-500/30" },
];

const LAYERS: { value: DataLayer | null; label: string }[] = [
  { value: null, label: "None" },
  { value: "raw", label: "RAW" },
  { value: "core", label: "CORE" },
  { value: "refined", label: "REFINED" },
  { value: "application", label: "APP" },
];

export function EnrichmentEditor({ registryId, entry, onClose, onSaved }: EnrichmentEditorProps) {
  const [description, setDescription] = useState(entry.description || "");
  const [ownerTeam, setOwnerTeam] = useState(entry.owner_team || "");
  const [tags, setTags] = useState<string[]>(entry.tags || []);
  const [classification, setClassification] = useState<DataClassification>(entry.classification || "internal");
  const [dataLayer, setDataLayer] = useState<DataLayer | null>(entry.data_layer ?? null);
  const [newTag, setNewTag] = useState("");
  const [saving, setSaving] = useState(false);

  const addTag = () => {
    const tag = newTag.trim().toLowerCase();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
    }
    setNewTag("");
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateEnrichment(registryId, entry.subject, {
        description: description || null,
        owner_team: ownerTeam || null,
        tags,
        classification,
        data_layer: dataLayer,
      });

      onSaved({
        ...entry,
        description: description || null,
        owner_team: ownerTeam || null,
        tags,
        classification,
        data_layer: dataLayer,
      });

      toast.success("Enrichment updated");
      onClose();
    } catch (err: any) {
      toast.error(err?.detail || "Failed to save enrichment");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Drawer */}
      <div className="relative w-[420px] bg-card border-l border-border h-full flex flex-col animate-in slide-in-from-right-2">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-sm font-semibold">Edit Enrichment</h2>
            <p className="text-xs text-muted-foreground truncate max-w-[300px]" title={entry.subject}>
              {entry.subject}
            </p>
          </div>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose}>
            <X size={16} />
          </Button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this event represent?"
              rows={3}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          {/* Owner */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Owner Team</label>
            <Input
              value={ownerTeam}
              onChange={(e) => setOwnerTeam(e.target.value)}
              placeholder="e.g. data-platform, marketing"
              className="h-9 text-sm"
            />
          </div>

          {/* Classification */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Classification</label>
            <div className="flex flex-wrap gap-2">
              {CLASSIFICATIONS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setClassification(c.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-medium border transition-all",
                    classification === c.value
                      ? cn(c.color, "ring-1 ring-white/20")
                      : "bg-muted/30 text-muted-foreground border-transparent hover:border-border"
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Data Layer */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Data Layer</label>
            <div className="flex flex-wrap gap-1.5">
              {LAYERS.map((l) => {
                const isActive = dataLayer === l.value;
                return (
                  <button
                    key={l.value ?? "none"}
                    type="button"
                    onClick={() => setDataLayer(l.value)}
                    className={cn(
                      "rounded px-2.5 py-1.5 text-xs font-medium transition-all border",
                      isActive
                        ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/30 ring-1 ring-cyan-500/20"
                        : "bg-muted/30 text-muted-foreground border-transparent hover:border-border"
                    )}
                  >
                    {l.value ? <DataLayerBadge layer={l.value} size="sm" /> : "None"}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-muted-foreground/60">
              Data maturity: RAW → CORE → REFINED → APP
            </p>
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Tags</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="text-[10px] gap-1 pr-1 group"
                >
                  <Tag size={9} />
                  {tag}
                  <button
                    onClick={() => removeTag(tag)}
                    className="ml-0.5 opacity-50 group-hover:opacity-100 hover:text-red-400"
                  >
                    <X size={10} />
                  </button>
                </Badge>
              ))}
              {tags.length === 0 && (
                <span className="text-xs text-muted-foreground/50">No tags yet</span>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                placeholder="Add a tag…"
                className="h-8 text-xs flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2"
                onClick={addTag}
                disabled={!newTag.trim()}
              >
                <Plus size={14} />
              </Button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}