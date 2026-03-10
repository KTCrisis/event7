// src/app/(dashboard)/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileCode, Database, Layers, GitBranch,
  ArrowRight, Loader2, Settings, Braces,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRegistry } from "@/providers/registry-provider";
import { listSubjects } from "@/lib/api/schemas";
import type { SubjectInfo } from "@/types/schema";

interface Stats {
  total: number;
  avro: number;
  json: number;
  protobuf: number;
  withRefs: number;
  multiVersion: number;
}

function computeStats(subjects: SubjectInfo[]): Stats {
  return {
    total: subjects.length,
    avro: subjects.filter((s) => s.format === "AVRO").length,
    json: subjects.filter((s) => s.format === "JSON").length,
    protobuf: subjects.filter((s) => s.format === "PROTOBUF").length,
    withRefs: 0, // would need references data
    multiVersion: subjects.filter((s) => s.version_count > 1).length,
  };
}

export default function DashboardPage() {
  const { selected: registry } = useRegistry();
  const router = useRouter();
  const [subjects, setSubjects] = useState<SubjectInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (!registry) {
      setSubjects([]);
      setStats(null);
      return;
    }

    setLoading(true);
    listSubjects(registry.id)
      .then((data) => {
        setSubjects(data);
        setStats(computeStats(data));
      })
      .catch(() => {
        setSubjects([]);
        setStats(null);
      })
      .finally(() => setLoading(false));
  }, [registry]);

  // No registry — prompt to connect
  if (!registry) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6">
        <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 flex items-center justify-center">
          <Database size={32} className="text-cyan-500" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-lg font-semibold">Welcome to event7</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            Connect a Schema Registry to start exploring your schemas,
            tracking versions, and governing your event-driven architecture.
          </p>
        </div>
        <Button onClick={() => router.push("/settings")} className="gap-2">
          <Settings size={14} />
          Connect a Registry
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground gap-2">
        <Loader2 className="animate-spin" size={18} />
        Loading dashboard…
      </div>
    );
  }

  return (
    <div className="space-y-6 p-2">
      {/* Registry header */}
      <div>
        <h1 className="text-lg font-semibold">{registry.name}</h1>
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">{registry.provider_type}</Badge>
          <span>{registry.environment}</span>
        </p>
      </div>

      {/* KPI cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Total Schemas"
            value={stats.total}
            icon={<Layers size={18} className="text-cyan-500" />}
            accent="cyan"
          />
          <KpiCard
            label="Avro Schemas"
            value={stats.avro}
            icon={<FileCode size={18} className="text-cyan-400" />}
            accent="cyan"
          />
          <KpiCard
            label="JSON Schemas"
            value={stats.json}
            icon={<Braces size={18} className="text-amber-400" />}
            accent="amber"
          />
          <KpiCard
            label="Multi-Version"
            value={stats.multiVersion}
            icon={<GitBranch size={18} className="text-purple-400" />}
            accent="purple"
          />
        </div>
      )}

      {/* Recent subjects */}
      {subjects.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-medium">Schemas</h3>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs gap-1 text-cyan-400 hover:text-cyan-300"
              onClick={() => router.push("/schemas")}
            >
              View all <ArrowRight size={12} />
            </Button>
          </div>
          <div className="divide-y divide-border/50">
            {subjects.slice(0, 8).map((s) => (
              <button
                key={s.subject}
                onClick={() => router.push("/schemas")}
                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/30 transition-colors text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileCode size={14} className="text-muted-foreground shrink-0" />
                  <span className="text-sm truncate">{s.subject}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1.5 py-0 h-4 ${
                      s.format === "AVRO"
                        ? "text-cyan-400 border-cyan-500/20"
                        : "text-amber-400 border-amber-500/20"
                    }`}
                  >
                    {s.format}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    v{s.latest_version}
                  </span>
                </div>
              </button>
            ))}
          </div>
          {subjects.length > 8 && (
            <div className="px-4 py-2 border-t border-border text-[11px] text-muted-foreground text-center">
              + {subjects.length - 8} more schemas
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// --- KPI Card ---

function KpiCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent: "cyan" | "amber" | "purple";
}) {
  const bgMap = {
    cyan: "bg-cyan-500/5 border-cyan-500/10",
    amber: "bg-amber-500/5 border-amber-500/10",
    purple: "bg-purple-500/5 border-purple-500/10",
  };

  return (
    <Card className={`p-4 border ${bgMap[accent]}`}>
      <div className="flex items-center justify-between mb-3">
        {icon}
      </div>
      <div className="text-2xl font-bold tracking-tight">{value}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{label}</div>
    </Card>
  );
}