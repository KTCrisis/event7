// src/app/(dashboard)/validate/page.tsx
// Schema Validator — dry-run validation page
// Design doc: SCHEMA_VALIDATOR_DESIGN.md v1.0.0
// Pattern: page headers = text-lg font-semibold + icon size={18} text-cyan-400 + p-6
"use client";

import { useState, useEffect } from "react";
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronRight,
  Loader2,
  Upload,
  SkipForward,
  Plus,
  Minus,
  PenLine,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRegistry } from "@/providers/registry-provider";
import { listSubjects } from "@/lib/api/schemas";
import { validateSchema } from "@/lib/api/validator";
import type { SubjectInfo } from "@/types/schema";
import type {
  SchemaValidateResponse,
  Verdict,
  RuleViolation,
  RuleSkipped,
} from "@/types/validator";

// ================================================================
// Verdict Badge
// ================================================================

function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const key = verdict.toLowerCase() as "pass" | "warn" | "fail";
  const config = {
    pass: {
      icon: CheckCircle2,
      label: "PASS",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/30",
      text: "text-emerald-400",
    },
    warn: {
      icon: AlertTriangle,
      label: "WARN",
      bg: "bg-amber-500/10",
      border: "border-amber-500/30",
      text: "text-amber-400",
    },
    fail: {
      icon: XCircle,
      label: "FAIL",
      bg: "bg-red-500/10",
      border: "border-red-500/30",
      text: "text-red-400",
    },
  }[key];

  const Icon = config.icon;

  return (
    <div
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border ${config.bg} ${config.border}`}
    >
      <Icon size={20} className={config.text} />
      <span className={`text-lg font-bold ${config.text}`}>
        {config.label}
      </span>
    </div>
  );
}

// ================================================================
// Collapsible Section
// ================================================================

function Section({
  title,
  icon: Icon,
  badge,
  badgeColor = "text-slate-400",
  defaultOpen = true,
  children,
}: {
  title: string;
  icon: React.ElementType;
  badge?: string;
  badgeColor?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-lg border border-slate-800/60 bg-slate-900/30 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-4 py-3 text-left hover:bg-slate-800/30 transition-colors"
      >
        {open ? (
          <ChevronDown size={14} className="text-slate-500" />
        ) : (
          <ChevronRight size={14} className="text-slate-500" />
        )}
        <Icon size={15} className="text-cyan-400" />
        <span className="text-sm font-semibold text-slate-200">{title}</span>
        {badge && (
          <span className={`ml-auto text-xs font-medium ${badgeColor}`}>
            {badge}
          </span>
        )}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-slate-800/40">
          {children}
        </div>
      )}
    </div>
  );
}

// ================================================================
// Severity Badge
// ================================================================

function SeverityBadge({ severity }: { severity: string }) {
  const styles: Record<string, string> = {
    critical: "bg-red-500/10 text-red-400 border-red-500/20",
    error: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    warning: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    info: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${
        styles[severity] || styles.info
      }`}
    >
      {severity}
    </span>
  );
}

// ================================================================
// Main Page
// ================================================================

export default function ValidatePage() {
  const { selected } = useRegistry();
  const registryId = selected?.id;

  // Form state
  const [subjects, setSubjects] = useState<SubjectInfo[]>([]);
  const [subject, setSubject] = useState("");
  const [subjectSearch, setSubjectSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [schemaContent, setSchemaContent] = useState("");
  const [schemaType, setSchemaType] = useState<"AVRO" | "JSON" | "PROTOBUF">(
    "AVRO"
  );

  // Result state
  const [result, setResult] = useState<SchemaValidateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load subjects for autocomplete
  useEffect(() => {
    if (!registryId) return;
    listSubjects(registryId)
      .then(setSubjects)
      .catch(() => setSubjects([]));
  }, [registryId]);

  const filteredSubjects = subjects.filter((s) =>
    s.subject.toLowerCase().includes(subjectSearch.toLowerCase())
  );

  // File upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setSchemaContent(text);
      // Auto-detect format
      try {
        const parsed = JSON.parse(text);
        if (parsed.type === "record" || parsed.namespace) {
          setSchemaType("AVRO");
        } else if (parsed.$schema || parsed.properties) {
          setSchemaType("JSON");
        }
      } catch {
        // Not JSON — could be Protobuf
      }
    };
    reader.readAsText(file);
  };

  // Validate
  const handleValidate = async () => {
    if (!registryId || !subject || !schemaContent) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Quick JSON check before calling API
      JSON.parse(schemaContent);
    } catch {
      setError("Invalid JSON — please check your schema syntax.");
      setLoading(false);
      return;
    }

    try {
      const res = await validateSchema(registryId, {
        subject,
        schema_content: schemaContent,
        schema_type: schemaType,
      });
      setResult(res);
    } catch (err: unknown) {
      const apiErr = err as { detail?: string };
      setError(apiErr?.detail || "Validation failed");
    } finally {
      setLoading(false);
    }
  };

  if (!registryId) {
    return (
      <div className="p-6 text-slate-500">
        Connect a registry in Settings to use the Schema Validator.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <ShieldCheck size={18} className="text-cyan-400" />
        <h1 className="text-lg font-semibold text-slate-100">
          Schema Validator
        </h1>
        <span className="text-xs text-slate-500 ml-2">
          Validate before you publish — compatibility + governance + diff
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ════════════════════════════════════════════════ */}
        {/* LEFT — Form                                      */}
        {/* ════════════════════════════════════════════════ */}
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-800/60 bg-slate-900/30 p-4 space-y-4">
            {/* Subject picker */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400">
                Subject
              </label>
              <div className="relative">
                <Input
                  placeholder="Search subjects..."
                  value={subject || subjectSearch}
                  onChange={(e) => {
                    setSubjectSearch(e.target.value);
                    setSubject("");
                    setShowDropdown(true);
                  }}
                  onFocus={() => setShowDropdown(true)}
                  className="bg-slate-900/50 border-slate-700 text-sm"
                />
                {showDropdown && subjectSearch && filteredSubjects.length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-md border border-slate-700 bg-slate-900 shadow-lg">
                    {filteredSubjects.slice(0, 20).map((s) => (
                      <button
                        key={s.subject}
                        onClick={() => {
                          setSubject(s.subject);
                          setSubjectSearch("");
                          setShowDropdown(false);
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 transition-colors"
                      >
                        {s.subject}
                        <span className="ml-2 text-xs text-slate-500">
                          v{s.latest_version} · {s.format}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Format selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400">
                Format
              </label>
              <div className="flex gap-2">
                {(["AVRO", "JSON", "PROTOBUF"] as const).map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => setSchemaType(fmt)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                      schemaType === fmt
                        ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-400"
                        : "border-slate-700 bg-slate-900/50 text-slate-400 hover:border-slate-600"
                    }`}
                  >
                    {fmt}
                  </button>
                ))}
              </div>
            </div>

            {/* Schema textarea */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400">
                Schema (JSON)
              </label>
              <textarea
                value={schemaContent}
                onChange={(e) => setSchemaContent(e.target.value)}
                placeholder='{\n  "type": "record",\n  "name": "User",\n  "namespace": "com.event7",\n  "fields": [...]\n}'
                rows={16}
                className="w-full rounded-md border border-slate-700 bg-slate-950/50 px-3 py-2 text-sm text-slate-200 font-mono placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 resize-y"
              />
            </div>

            {/* File upload */}
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-400 border border-slate-700 rounded-md cursor-pointer hover:border-slate-600 hover:text-slate-300 transition-colors">
                <Upload size={13} />
                Upload .avsc / .json
                <input
                  type="file"
                  accept=".avsc,.json,.avro"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            {/* Validate button */}
            <Button
              onClick={handleValidate}
              disabled={!subject || !schemaContent || loading}
              className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-medium"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin mr-2" />
                  Validating...
                </>
              ) : (
                <>
                  <ShieldCheck size={14} className="mr-2" />
                  Validate
                </>
              )}
            </Button>

            {/* Error */}
            {error && (
              <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* ════════════════════════════════════════════════ */}
        {/* RIGHT — Report                                   */}
        {/* ════════════════════════════════════════════════ */}
        <div className="space-y-4">
          {!result && !loading && (
            <div className="rounded-lg border border-slate-800/60 bg-slate-900/30 p-8 text-center">
              <ShieldCheck
                size={32}
                className="text-slate-600 mx-auto mb-3"
              />
              <p className="text-sm text-slate-500">
                Paste a schema and click Validate to see the report.
              </p>
              <p className="text-xs text-slate-600 mt-1">
                Compatibility check + governance rules + field-level diff
              </p>
            </div>
          )}

          {loading && (
            <div className="rounded-lg border border-slate-800/60 bg-slate-900/30 p-8 text-center">
              <Loader2
                size={24}
                className="text-cyan-400 mx-auto mb-3 animate-spin"
              />
              <p className="text-sm text-slate-400">
                Checking compatibility, evaluating rules, computing diff...
              </p>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              {/* Verdict */}
              <div className="flex items-center justify-between">
                <VerdictBadge verdict={result.verdict} />
                <span className="text-xs text-slate-500">
                  {result.subject} · compared to v
                  {result.compare_version ?? "new"}
                </span>
              </div>

              {/* ① Compatibility */}
              <Section
                title="Compatibility"
                icon={ShieldCheck}
                badge={
                  result.compatibility.provider_checked
                    ? result.compatibility.is_compatible
                      ? "Compatible"
                      : "Incompatible"
                    : "Not checked"
                }
                badgeColor={
                  !result.compatibility.provider_checked
                    ? "text-slate-500"
                    : result.compatibility.is_compatible
                    ? "text-emerald-400"
                    : "text-red-400"
                }
              >
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-slate-400">
                    <span className="text-xs text-slate-500 w-16">Mode</span>
                    <span className="font-mono text-xs text-slate-300">
                      {result.compatibility.mode}
                    </span>
                  </div>
                  {result.compatibility.messages.length > 0 && (
                    <div className="space-y-1 mt-2">
                      {result.compatibility.messages.map((msg, i) => (
                        <div
                          key={i}
                          className="text-xs text-slate-400 bg-slate-800/40 rounded px-2 py-1.5 font-mono"
                        >
                          {msg}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Section>

              {/* ② Governance Rules */}
              <Section
                title="Governance Rules"
                icon={ShieldCheck}
                badge={`${result.governance.passed}/${result.governance.total} passed · Score: ${result.governance.score}`}
                badgeColor={
                  result.governance.failed > 0
                    ? "text-amber-400"
                    : "text-emerald-400"
                }
              >
                <div className="space-y-2">
                  {result.governance.violations.length === 0 &&
                    result.governance.skipped.length === 0 &&
                    result.governance.total === 0 && (
                      <p className="text-xs text-slate-500">
                        No governance rules configured for this subject.
                      </p>
                    )}

                  {result.governance.violations.length === 0 &&
                    result.governance.passed > 0 && (
                      <p className="text-xs text-emerald-400">
                        All evaluable rules passed.
                      </p>
                    )}

                  {/* Violations */}
                  {result.governance.violations.map((v, i) => (
                    <ViolationRow key={i} violation={v} />
                  ))}

                  {/* Skipped */}
                  {result.governance.skipped.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-800/40">
                      <p className="text-[10px] uppercase tracking-wider text-slate-600 mb-2">
                        Skipped ({result.governance.skipped.length})
                      </p>
                      {result.governance.skipped.map((s, i) => (
                        <SkippedRow key={i} skipped={s} />
                      ))}
                    </div>
                  )}
                </div>
              </Section>

              {/* ③ Diff Preview */}
              <Section
                title="Diff Preview"
                icon={PenLine}
                badge={
                  result.diff.is_new_subject
                    ? "New subject"
                    : result.diff.has_changes
                    ? `${result.diff.total_changes} change${result.diff.total_changes !== 1 ? "s" : ""}${
                        result.diff.is_breaking ? " · Breaking" : ""
                      }`
                    : "No changes"
                }
                badgeColor={
                  result.diff.is_breaking
                    ? "text-red-400"
                    : result.diff.has_changes
                    ? "text-cyan-400"
                    : "text-slate-500"
                }
              >
                <div className="space-y-1.5">
                  {result.diff.is_new_subject && (
                    <p className="text-xs text-slate-500">
                      New subject — no previous version to diff against.
                    </p>
                  )}

                  {!result.diff.has_changes && !result.diff.is_new_subject && (
                    <p className="text-xs text-slate-500">
                      No field-level changes detected.
                    </p>
                  )}

                  {result.diff.fields_added.map((f) => (
                    <DiffLine key={`+${f}`} type="added" field={f} />
                  ))}
                  {result.diff.fields_removed.map((f) => (
                    <DiffLine key={`-${f}`} type="removed" field={f} />
                  ))}
                  {result.diff.fields_modified.map((f) => (
                    <DiffLine key={`~${f}`} type="modified" field={f} />
                  ))}
                </div>
              </Section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ================================================================
// Sub-components
// ================================================================

function ViolationRow({ violation }: { violation: RuleViolation }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <XCircle size={13} className="text-red-400 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-200">
            {violation.rule_name}
          </span>
          <SeverityBadge severity={violation.severity} />
        </div>
        <p className="text-slate-500 mt-0.5">{violation.message}</p>
      </div>
    </div>
  );
}

function SkippedRow({ skipped }: { skipped: RuleSkipped }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <SkipForward size={12} className="text-slate-600 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-slate-500">{skipped.rule_name}</span>
        <span className="text-slate-600 ml-1.5">— {skipped.reason}</span>
      </div>
    </div>
  );
}

function DiffLine({
  type,
  field,
}: {
  type: "added" | "removed" | "modified";
  field: string;
}) {
  const config = {
    added: {
      icon: Plus,
      color: "text-emerald-400",
      bg: "bg-emerald-500/5",
      prefix: "+",
    },
    removed: {
      icon: Minus,
      color: "text-red-400",
      bg: "bg-red-500/5",
      prefix: "−",
    },
    modified: {
      icon: PenLine,
      color: "text-amber-400",
      bg: "bg-amber-500/5",
      prefix: "~",
    },
  }[type];

  const Icon = config.icon;

  return (
    <div
      className={`flex items-center gap-2 rounded px-2 py-1 text-xs font-mono ${config.bg}`}
    >
      <Icon size={12} className={config.color} />
      <span className={config.color}>
        {config.prefix} {field}
      </span>
    </div>
  );
}