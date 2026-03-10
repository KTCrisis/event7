// src/components/schemas/side-by-side-diff.tsx
"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface SideBySideDiffProps {
  left: Record<string, unknown>;
  right: Record<string, unknown>;
  leftLabel: string;
  rightLabel: string;
}

type DiffLineType = "unchanged" | "added" | "removed" | "modified";

interface DiffLine {
  left: string | null;
  right: string | null;
  leftNum: number | null;
  rightNum: number | null;
  type: DiffLineType;
}

// Simple LCS-based line diff
function computeLineDiff(leftLines: string[], rightLines: string[]): DiffLine[] {
  const m = leftLines.length;
  const n = rightLines.length;

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (leftLines[i - 1].trim() === rightLines[j - 1].trim()) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to build diff
  const result: DiffLine[] = [];
  let i = m;
  let j = n;

  const stack: DiffLine[] = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && leftLines[i - 1].trim() === rightLines[j - 1].trim()) {
      stack.push({
        left: leftLines[i - 1],
        right: rightLines[j - 1],
        leftNum: i,
        rightNum: j,
        type: "unchanged",
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      stack.push({
        left: null,
        right: rightLines[j - 1],
        leftNum: null,
        rightNum: j,
        type: "added",
      });
      j--;
    } else {
      stack.push({
        left: leftLines[i - 1],
        right: null,
        leftNum: i,
        rightNum: null,
        type: "removed",
      });
      i--;
    }
  }

  // Reverse since we built bottom-up
  stack.reverse();

  // Merge adjacent removed+added into modified pairs
  for (let k = 0; k < stack.length; k++) {
    if (
      k + 1 < stack.length &&
      stack[k].type === "removed" &&
      stack[k + 1].type === "added"
    ) {
      result.push({
        left: stack[k].left,
        right: stack[k + 1].right,
        leftNum: stack[k].leftNum,
        rightNum: stack[k + 1].rightNum,
        type: "modified",
      });
      k++; // skip next
    } else {
      result.push(stack[k]);
    }
  }

  return result;
}

// Highlight inline differences within a modified line
function highlightInlineDiff(
  oldText: string,
  newText: string
): { oldHtml: string; newHtml: string } {
  // Find common prefix
  let prefixLen = 0;
  while (
    prefixLen < oldText.length &&
    prefixLen < newText.length &&
    oldText[prefixLen] === newText[prefixLen]
  ) {
    prefixLen++;
  }

  // Find common suffix
  let suffixLen = 0;
  while (
    suffixLen < oldText.length - prefixLen &&
    suffixLen < newText.length - prefixLen &&
    oldText[oldText.length - 1 - suffixLen] === newText[newText.length - 1 - suffixLen]
  ) {
    suffixLen++;
  }

  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const prefix = esc(oldText.slice(0, prefixLen));
  const oldMid = esc(oldText.slice(prefixLen, oldText.length - suffixLen));
  const newMid = esc(newText.slice(prefixLen, newText.length - suffixLen));
  const suffix = esc(oldText.slice(oldText.length - suffixLen));

  return {
    oldHtml: oldMid
      ? `${prefix}<span class="bg-red-500/30 rounded px-0.5">${oldMid}</span>${suffix}`
      : `${prefix}${suffix}`,
    newHtml: newMid
      ? `${prefix}<span class="bg-emerald-500/30 rounded px-0.5">${newMid}</span>${suffix}`
      : `${prefix}${suffix}`,
  };
}

const LINE_STYLES: Record<DiffLineType, { left: string; right: string }> = {
  unchanged: { left: "", right: "" },
  added: { left: "bg-transparent", right: "bg-emerald-500/10" },
  removed: { left: "bg-red-500/10", right: "bg-transparent" },
  modified: { left: "bg-red-500/10", right: "bg-emerald-500/10" },
};

const GUTTER_STYLES: Record<DiffLineType, { left: string; right: string }> = {
  unchanged: { left: "text-slate-600", right: "text-slate-600" },
  added: { left: "text-slate-700", right: "text-emerald-600" },
  removed: { left: "text-red-600", right: "text-slate-700" },
  modified: { left: "text-red-600", right: "text-emerald-600" },
};

export function SideBySideDiff({
  left,
  right,
  leftLabel,
  rightLabel,
}: SideBySideDiffProps) {
  const diffLines = useMemo(() => {
    const leftStr = JSON.stringify(left, null, 2);
    const rightStr = JSON.stringify(right, null, 2);
    return computeLineDiff(leftStr.split("\n"), rightStr.split("\n"));
  }, [left, right]);

  const stats = useMemo(() => {
    let added = 0, removed = 0, modified = 0;
    diffLines.forEach((l) => {
      if (l.type === "added") added++;
      else if (l.type === "removed") removed++;
      else if (l.type === "modified") modified++;
    });
    return { added, removed, modified };
  }, [diffLines]);

  return (
    <div className="flex flex-col h-full overflow-hidden rounded-lg border border-border">
      {/* Headers */}
      <div className="flex shrink-0 border-b border-border text-xs font-medium">
        <div className="flex-1 px-4 py-2 bg-red-500/5 text-red-400 border-r border-border">
          {leftLabel}
          {stats.removed > 0 && (
            <span className="ml-2 text-[10px] opacity-70">−{stats.removed + stats.modified}</span>
          )}
        </div>
        <div className="flex-1 px-4 py-2 bg-emerald-500/5 text-emerald-400">
          {rightLabel}
          {stats.added > 0 && (
            <span className="ml-2 text-[10px] opacity-70">+{stats.added + stats.modified}</span>
          )}
        </div>
      </div>

      {/* Diff lines */}
      <div className="flex-1 overflow-auto font-mono text-[13px] leading-6">
        {diffLines.map((line, idx) => {
          const styles = LINE_STYLES[line.type];
          const gutterStyles = GUTTER_STYLES[line.type];

          let leftHtml = "";
          let rightHtml = "";

          if (line.type === "modified" && line.left && line.right) {
            const { oldHtml, newHtml } = highlightInlineDiff(line.left, line.right);
            leftHtml = oldHtml;
            rightHtml = newHtml;
          } else {
            const esc = (s: string) =>
              s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            leftHtml = line.left ? esc(line.left) : "";
            rightHtml = line.right ? esc(line.right) : "";
          }

          return (
            <div key={idx} className="flex">
              {/* Left panel */}
              <div className={cn("flex flex-1 border-r border-border min-w-0", styles.left)}>
                {/* Gutter */}
                <div
                  className={cn(
                    "shrink-0 w-10 text-right pr-2 select-none border-r border-border/30",
                    gutterStyles.left
                  )}
                >
                  {line.leftNum ?? ""}
                </div>
                {/* Marker */}
                <div className="shrink-0 w-5 text-center select-none">
                  {line.type === "removed" && <span className="text-red-400">−</span>}
                  {line.type === "modified" && <span className="text-red-400">~</span>}
                </div>
                {/* Code */}
                <pre className="flex-1 px-2 overflow-hidden">
                  <code
                    dangerouslySetInnerHTML={{ __html: leftHtml || "&nbsp;" }}
                    className={cn(line.left === null && "opacity-0")}
                  />
                </pre>
              </div>

              {/* Right panel */}
              <div className={cn("flex flex-1 min-w-0", styles.right)}>
                {/* Gutter */}
                <div
                  className={cn(
                    "shrink-0 w-10 text-right pr-2 select-none border-r border-border/30",
                    gutterStyles.right
                  )}
                >
                  {line.rightNum ?? ""}
                </div>
                {/* Marker */}
                <div className="shrink-0 w-5 text-center select-none">
                  {line.type === "added" && <span className="text-emerald-400">+</span>}
                  {line.type === "modified" && <span className="text-emerald-400">~</span>}
                </div>
                {/* Code */}
                <pre className="flex-1 px-2 overflow-hidden">
                  <code
                    dangerouslySetInnerHTML={{ __html: rightHtml || "&nbsp;" }}
                    className={cn(line.right === null && "opacity-0")}
                  />
                </pre>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}