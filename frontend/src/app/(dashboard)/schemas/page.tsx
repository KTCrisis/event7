// src/app/(dashboard)/schemas/page.tsx
"use client";

import { useEffect, useState } from "react";
import { FileCode, Loader2, AlertCircle, DatabaseZap } from "lucide-react";
import { useRegistry } from "@/providers/registry-provider";
import { listSubjects } from "@/lib/api/schemas";
import { SubjectList } from "@/components/schemas/subject-list";
import { SchemaDetail } from "@/components/schemas/schema-detail";
import type { SubjectInfo } from "@/types/schema";

export default function SchemasPage() {
  const { selected: registry } = useRegistry();
  const [subjects, setSubjects] = useState<SubjectInfo[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch subjects when registry changes
  useEffect(() => {
    if (!registry) {
      setSubjects([]);
      setSelectedSubject(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    listSubjects(registry.id)
      .then((data) => {
        if (cancelled) return;
        setSubjects(data);
        setSelectedSubject(null);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.detail || "Failed to load subjects");
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [registry]);

  // No registry selected
  if (!registry) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
        <DatabaseZap size={40} className="text-muted-foreground/40" />
        <p className="text-sm">Select a registry to explore schemas</p>
      </div>
    );
  }

  // Loading
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground gap-2">
        <Loader2 className="animate-spin" size={18} />
        <span className="text-sm">Loading subjects…</span>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-destructive gap-2">
        <AlertCircle size={24} />
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full -m-6">
      {/* Left panel — Subject list */}
      <div className="w-80 shrink-0 border-r border-border bg-card">
        <SubjectList
          subjects={subjects}
          selected={selectedSubject}
          onSelect={setSelectedSubject}
        />
      </div>

      {/* Right panel — Schema detail */}
      <div className="flex-1 bg-background">
        {selectedSubject ? (
          <SchemaDetail
            registryId={registry.id}
            subject={selectedSubject}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
            <FileCode size={40} className="text-muted-foreground/30" />
            <p className="text-sm">Select a subject to view its schema</p>
            <p className="text-xs text-muted-foreground/60">
              {subjects.length} subject{subjects.length !== 1 ? "s" : ""} available
            </p>
          </div>
        )}
      </div>
    </div>
  );
}