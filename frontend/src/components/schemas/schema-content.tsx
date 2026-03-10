// src/components/schemas/schema-content.tsx
// JSON syntax highlighting with line numbers — dark theme, no external deps
"use client";

import { useMemo } from "react";

interface SchemaContentProps {
  content: Record<string, unknown>;
  maxHeight?: string;
}

function highlightJson(json: string): string {
  // Tokenize and highlight — avoid regex conflicts with class names
  return json.replace(
    /("(?:\\.|[^"\\])*")\s*(:)?|(\b-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)|(true|false)|(null)/g,
    (match, str, colon, num, bool, nil) => {
      if (str) {
        return colon
          ? `<span style="color:#67e8f9">${str}</span>:`
          : `<span style="color:#6ee7b7">${str}</span>`;
      }
      if (num) return `<span style="color:#fbbf24">${num}</span>`;
      if (bool) return `<span style="color:#c084fc">${bool}</span>`;
      if (nil) return `<span style="color:#64748b">null</span>`;
      return match;
    }
  );
}
export function SchemaContent({ content, maxHeight = "600px" }: SchemaContentProps) {
  const { highlighted, lineCount } = useMemo(() => {
    const raw = JSON.stringify(content, null, 2);
    const lines = raw.split("\n");
    return {
      highlighted: highlightJson(raw),
      lineCount: lines.length,
    };
  }, [content]);

  return (
    <div
      className="relative rounded-lg border border-border bg-slate-950 overflow-auto font-mono text-[13px] leading-6"
      style={{ maxHeight }}
    >
      <div className="flex">
        {/* Line numbers */}
        <div className="sticky left-0 shrink-0 select-none border-r border-border/40 bg-slate-950/80 px-3 py-4 text-right text-slate-600">
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
        {/* Content */}
        <pre className="flex-1 p-4 overflow-x-auto">
          <code dangerouslySetInnerHTML={{ __html: highlighted }} />
        </pre>
      </div>
    </div>
  );
}