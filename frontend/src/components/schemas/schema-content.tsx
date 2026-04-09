// src/components/schemas/schema-content.tsx
// Syntax highlighting with line numbers — dark theme, no external deps
// Supports JSON (Avro, JSON Schema) and Protobuf (.proto)
"use client";

import { useMemo } from "react";

interface SchemaContentProps {
  content: Record<string, unknown> | string;
  maxHeight?: string;
  format?: string;
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

function highlightProto(text: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return text
    .split("\n")
    .map((line) => {
      let escaped = esc(line);
      // Comments
      escaped = escaped.replace(
        /(\/\/.*)/g,
        '<span style="color:#64748b">$1</span>'
      );
      // Keywords
      escaped = escaped.replace(
        /\b(syntax|package|import|option|message|enum|oneof|map|service|rpc|returns|reserved|repeated|optional|required|stream)\b/g,
        '<span style="color:#c084fc">$1</span>'
      );
      // Types
      escaped = escaped.replace(
        /\b(string|int32|int64|uint32|uint64|sint32|sint64|fixed32|fixed64|sfixed32|sfixed64|float|double|bool|bytes)\b/g,
        '<span style="color:#67e8f9">$1</span>'
      );
      // Strings
      escaped = escaped.replace(
        /("(?:[^"\\]|\\.)*")/g,
        '<span style="color:#6ee7b7">$1</span>'
      );
      // Numbers (field numbers after =)
      escaped = escaped.replace(
        /=\s*(\d+)/g,
        '= <span style="color:#fbbf24">$1</span>'
      );
      return escaped;
    })
    .join("\n");
}

export function SchemaContent({ content, maxHeight = "600px", format }: SchemaContentProps) {
  const { highlighted, lineCount } = useMemo(() => {
    const isProto = format === "PROTOBUF" || typeof content === "string";
    let raw: string;
    let hl: string;

    if (isProto && typeof content === "string") {
      raw = content;
      hl = highlightProto(raw);
    } else {
      raw = JSON.stringify(content, null, 2);
      hl = highlightJson(raw);
    }

    return {
      highlighted: hl,
      lineCount: raw.split("\n").length,
    };
  }, [content, format]);

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