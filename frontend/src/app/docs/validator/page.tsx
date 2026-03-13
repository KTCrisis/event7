// src/app/docs/validator/page.tsx
// Documentation page — Schema Validator
// Uses the docs layout (sidebar + header) — just exports an <article>

import {
  ShieldCheck,
  GitCompare,
  Shield,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileCode,
  Layers,
  ArrowRight,
  Rocket,
  Code2,
  Search,
} from "lucide-react";
import Link from "next/link";

export default function ValidatorPage() {
  return (
    <article>
      {/* Hero */}
      <div className="mb-12">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-teal-500/10 text-teal-400 border border-teal-500/20">
            Community
          </span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
            v1.0
          </span>
        </div>

        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight leading-tight mb-4">
          Schema Validator
        </h1>

        <p className="text-lg text-slate-400 leading-relaxed max-w-2xl mb-8">
          Validate a schema before publishing — in a single call. The Validator
          combines your registry&apos;s compatibility check, event7 governance
          rules evaluation, and a field-level diff preview into one unified
          report. No more &ldquo;push and pray&rdquo;.
        </p>
      </div>

      {/* The problem */}
      <section className="mb-14">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-6">
          The problem
        </h2>
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-6 text-sm text-slate-400 leading-relaxed space-y-3">
          <p>
            Today, a developer who wants to publish a new schema version has to
            push it to the registry and find out after the fact whether it&apos;s
            compatible. There&apos;s no single place to check compatibility,
            governance rules, and the actual diff — all before publishing.
          </p>
          <p>
            Confluent&apos;s UI shows the compatibility mode but offers no
            visual dry-run. Apicurio has no &ldquo;test before publish&rdquo;
            feature. Conduktor and Lenses focus on runtime ops, not pre-publish
            validation. And none of them evaluate governance rules (naming
            conventions, required fields, documentation standards) alongside
            technical compatibility.
          </p>
          <p className="text-slate-300 font-medium">
            event7&apos;s Schema Validator solves this by combining three checks
            in one report — so you know if your schema is ready before it touches
            the registry.
          </p>
        </div>
      </section>

      {/* Three checks, one report */}
      <section className="mb-14">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-6">
          Three checks, one report
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-5">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
                ① Compatibility
              </span>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              Proxies your registry&apos;s compatibility API (Confluent, Apicurio
              via ccompat/v7, Karapace, Redpanda). Returns whether the schema is
              compatible with the current version, plus detailed error messages
              if not.
            </p>
          </div>
          <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="h-4 w-4 text-cyan-400" />
              <span className="text-xs font-semibold uppercase tracking-widest text-cyan-400">
                ② Governance Rules
              </span>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              Evaluates all event7 governance rules applicable to the subject —
              naming conventions, required fields, documentation standards,
              field count limits, and regex patterns. Returns score, violations
              count, and details per rule.
            </p>
          </div>
          <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-5">
            <div className="flex items-center gap-2 mb-3">
              <GitCompare className="h-4 w-4 text-amber-400" />
              <span className="text-xs font-semibold uppercase tracking-widest text-amber-400">
                ③ Diff Preview
              </span>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              Field-level diff against the current version — fields added,
              removed, or modified. Uses the same LCS-based diff engine as the
              Visual Diff Viewer. Flags breaking changes independently of the
              SR.
            </p>
          </div>
        </div>
      </section>

      {/* Verdict logic */}
      <section className="mb-14">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-6">
          Verdict logic
        </h2>
        <p className="text-sm text-slate-400 leading-relaxed mb-5 max-w-2xl">
          The three checks are combined into a single verdict. event7 applies a
          defense-in-depth strategy: even if the SR says &ldquo;compatible&rdquo;,
          event7 independently detects breaking changes by crossing the
          compatibility mode with the actual diff.
        </p>

        <div className="rounded-xl border border-slate-800/60 bg-slate-900/20 divide-y divide-slate-800/40 overflow-hidden">
          {[
            {
              verdict: "FAIL",
              color: "text-red-400",
              icon: XCircle,
              conditions: [
                "SR reports incompatible",
                "Governance violations with severity error or critical",
                "Breaking changes detected + strict compatibility mode (BACKWARD, FORWARD, FULL, *_TRANSITIVE)",
              ],
            },
            {
              verdict: "WARN",
              color: "text-amber-400",
              icon: AlertTriangle,
              conditions: [
                "Breaking changes detected + non-strict mode (NONE, unknown)",
                "Governance violations with severity warning or info only",
              ],
            },
            {
              verdict: "PASS",
              color: "text-emerald-400",
              icon: CheckCircle2,
              conditions: [
                "SR compatible + no governance violations (error/critical) + no breaking changes in strict mode",
              ],
            },
          ].map((row) => (
            <div key={row.verdict} className="flex items-start gap-4 px-5 py-4">
              <div className="flex items-center gap-2 shrink-0 w-20 mt-0.5">
                <row.icon className={`h-4 w-4 ${row.color}`} />
                <span className={`text-sm font-bold ${row.color}`}>
                  {row.verdict}
                </span>
              </div>
              <div className="space-y-1">
                {row.conditions.map((c) => (
                  <p key={c} className="text-sm text-slate-400">
                    {c}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Governance evaluators */}
      <section className="mb-14">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-6">
          Governance evaluators
        </h2>
        <p className="text-sm text-slate-400 leading-relaxed mb-5 max-w-2xl">
          The Validator runs five built-in evaluators against the candidate
          schema. Each evaluator maps to governance rule categories defined in
          event7. Only rules with scope{" "}
          <code className="text-slate-300 text-xs bg-slate-800/50 px-1.5 py-0.5 rounded">
            declarative
          </code>{" "}
          or{" "}
          <code className="text-slate-300 text-xs bg-slate-800/50 px-1.5 py-0.5 rounded">
            audit
          </code>{" "}
          are evaluated — runtime and control_plane rules are skipped (with a
          note in the report).
        </p>

        <div className="rounded-xl border border-slate-800/60 bg-slate-900/20 divide-y divide-slate-800/40 overflow-hidden">
          {[
            {
              name: "require_doc_fields",
              desc: "Checks that all fields have documentation (doc for Avro, description for JSON Schema).",
              example: 'Field "email" missing doc annotation',
            },
            {
              name: "require_fields",
              desc: "Verifies that mandatory fields are present (via rule params.required_fields or heuristic detection).",
              example: 'Required field "id" not found in schema',
            },
            {
              name: "naming_convention",
              desc: "Validates record name, namespace, and subject name against regex patterns defined in the rule.",
              example: 'Record name "user_event" does not match pattern "^[A-Z][a-zA-Z0-9]+$"',
            },
            {
              name: "max_fields",
              desc: "Flags schemas with too many fields (default threshold: 30). Catches god-schemas.",
              example: "Schema has 42 fields, exceeds maximum of 30",
            },
            {
              name: "field_regex",
              desc: "Validates all field names against a regex pattern (e.g. camelCase, snake_case enforcement).",
              example: 'Field "ZIP_CODE" does not match pattern "^[a-z][a-zA-Z0-9]*$"',
            },
          ].map((ev) => (
            <div key={ev.name} className="px-5 py-4">
              <div className="flex items-center gap-2 mb-1.5">
                <Code2 className="h-3.5 w-3.5 text-teal-400" />
                <code className="text-xs font-mono font-semibold text-slate-300">
                  {ev.name}
                </code>
              </div>
              <p className="text-sm text-slate-400 mb-1.5">{ev.desc}</p>
              <p className="text-xs text-slate-600 italic">
                Example: &ldquo;{ev.example}&rdquo;
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How to use */}
      <section className="mb-14">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-6">
          How to use
        </h2>
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Search className="h-4 w-4 text-cyan-400" />
              <span className="text-sm font-semibold text-white">
                Dedicated page — /validate
              </span>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed mb-3">
              Navigate to <strong className="text-slate-300">Validate</strong> in
              the sidebar (Explore group). The page is split in two:
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-800/50 bg-slate-900/50 p-4">
                <p className="text-xs font-semibold text-slate-300 mb-1.5">
                  Left — Input form
                </p>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Select the target subject (autocomplete from cache), pick the
                  format (Avro / JSON Schema / Protobuf), paste your schema
                  JSON or upload a .avsc / .json file. Click{" "}
                  <strong className="text-slate-400">Validate</strong>.
                </p>
              </div>
              <div className="rounded-lg border border-slate-800/50 bg-slate-900/50 p-4">
                <p className="text-xs font-semibold text-slate-300 mb-1.5">
                  Right — Validation report
                </p>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Verdict badge (PASS / WARN / FAIL), three collapsible sections:
                  Compatibility (mode + result + SR messages), Governance Rules
                  (score + violations), Diff Preview (fields +/−/~ with
                  breaking indicator).
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-5">
            <div className="flex items-center gap-2 mb-3">
              <FileCode className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-semibold text-white">
                JSON syntax check
              </span>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              Before calling the API, the frontend validates that the input
              parses as valid JSON — saving a round-trip for syntax errors.
              The schema content area uses a monospace font with line numbers
              for readability.
            </p>
          </div>
        </div>
      </section>

      {/* Provider support */}
      <section className="mb-14">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-6">
          Provider support
        </h2>
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/20 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800/60">
                <th className="text-left py-3 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Provider
                </th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Compatibility check
                </th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Governance rules
                </th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Diff preview
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: "Confluent Cloud", compat: true, gov: true, diff: true },
                { name: "Confluent Platform", compat: true, gov: true, diff: true },
                { name: "Apicurio v3", compat: true, gov: true, diff: true },
                { name: "Karapace (Aiven)", compat: true, gov: true, diff: true },
                { name: "Redpanda SR", compat: true, gov: true, diff: true },
                { name: "AWS Glue (future)", compat: false, gov: true, diff: true },
                { name: "Azure SR (future)", compat: false, gov: true, diff: true },
              ].map((row, i) => (
                <tr
                  key={row.name}
                  className={
                    i < 6 ? "border-b border-slate-800/30" : ""
                  }
                >
                  <td className="py-2.5 px-5 text-xs font-medium text-slate-300">
                    {row.name}
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    {row.compat ? (
                      <CheckCircle2 className="h-4 w-4 text-teal-400 mx-auto" />
                    ) : (
                      <span className="text-[10px] text-slate-600">N/A</span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    <CheckCircle2 className="h-4 w-4 text-teal-400 mx-auto" />
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    <CheckCircle2 className="h-4 w-4 text-teal-400 mx-auto" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-600 mt-3">
          Providers without a dry-run compatibility API (AWS Glue, Azure) will
          return governance rules + diff only — the compatibility section shows
          &ldquo;not available for this provider&rdquo;.
        </p>
      </section>

      {/* What's next */}
      <section className="mb-14">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-6">
          What&apos;s next
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            {
              icon: Layers,
              version: "v1.1",
              title: "Apicurio native dry-run",
              desc: "Use the X-Registry-DryRun header on Apicurio's native v3 API to validate all artifact rules — not just compatibility.",
            },
            {
              icon: GitCompare,
              version: "v1.2",
              title: "Impact Analysis",
              desc: "After the diff, show which schemas reference this subject (via the References Graph) and estimate the downstream impact of the change.",
            },
            {
              icon: Rocket,
              version: "v1.3",
              title: "CI/CD integration",
              desc: "The endpoint is already REST-friendly. A CLI wrapper or GitHub Action that calls POST /schemas/validate and returns exit code 0 (PASS) or 1 (FAIL) for pipeline gates.",
            },
            {
              icon: FileCode,
              version: "v1.4",
              title: "Batch validation",
              desc: "Validate multiple schemas in a single call — useful for monorepos with N schemas that evolve together.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-dashed border-slate-800/60 bg-slate-900/20 p-5"
            >
              <div className="flex items-center gap-2 mb-2">
                <item.icon className="h-4 w-4 text-slate-500" />
                <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
                  {item.version}
                </span>
              </div>
              <h3 className="text-sm font-semibold text-slate-300 mb-1.5">
                {item.title}
              </h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* API + links */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-6">
          Resources
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Link
            href="/docs/api-reference#schema-validator"
            className="group rounded-xl border border-slate-800/60 bg-slate-900/30 p-4 hover:border-teal-500/30 transition-colors"
          >
            <p className="text-sm font-semibold text-white mb-1 group-hover:text-teal-400 transition-colors">
              API Reference
            </p>
            <p className="text-xs text-slate-500">
              POST /schemas/validate — request &amp; response schema
            </p>
          </Link>
          <Link
            href="/docs/governance-rules"
            className="group rounded-xl border border-slate-800/60 bg-slate-900/30 p-4 hover:border-teal-500/30 transition-colors"
          >
            <p className="text-sm font-semibold text-white mb-1 group-hover:text-teal-400 transition-colors">
              Governance Rules
            </p>
            <p className="text-xs text-slate-500">
              Define rules that the Validator evaluates on each schema
            </p>
          </Link>
          <Link
            href="/docs/features"
            className="group rounded-xl border border-slate-800/60 bg-slate-900/30 p-4 hover:border-teal-500/30 transition-colors"
          >
            <p className="text-sm font-semibold text-white mb-1 group-hover:text-teal-400 transition-colors">
              All Features
            </p>
            <p className="text-xs text-slate-500">
              Full list of event7 capabilities
            </p>
          </Link>
        </div>
      </section>
    </article>
  );
}