"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sparkles,
  Blocks,
  Rocket,
  Code2,
  Scale,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const sections = [
  {
    label: "Overview",
    items: [
      { name: "Introduction", href: "/docs", icon: Sparkles },
      { name: "Features", href: "/docs/features", icon: Blocks },
    ],
  },
  {
    label: "Guides",
    items: [
      { name: "Getting Started", href: "/docs/getting-started", icon: Rocket },
    ],
  },
  {
    label: "Reference",
    items: [
      { name: "API Reference", href: "/docs/api-reference", icon: Code2 },
      { name: "Licensing", href: "/docs/licensing", icon: Scale },
    ],
  },
];

export function DocsSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-60 flex-col border-r border-slate-800/60 bg-slate-950/50 backdrop-blur-sm">
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 py-5 border-b border-slate-800/60">
        <Link href="/docs" className="flex items-center gap-0.5">
          <span className="text-lg font-semibold text-white tracking-tight">
            event
          </span>
          <span className="text-lg font-semibold text-teal-400 tracking-tight">
            7
          </span>
          <span className="ml-2 text-xs font-medium text-slate-500 uppercase tracking-widest">
            docs
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {sections.map((section) => (
          <div key={section.label}>
            <p className="px-2 mb-2 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
              {section.label}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors duration-150",
                        isActive
                          ? "bg-teal-500/10 text-teal-400 font-medium"
                          : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1">{item.name}</span>
                      {isActive && (
                        <ChevronRight className="h-3.5 w-3.5 text-teal-500/60" />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-800/60 px-5 py-4">
        <p className="text-[11px] text-slate-600">
          Apache 2.0 · Open-core
        </p>
      </div>
    </aside>
  );
}