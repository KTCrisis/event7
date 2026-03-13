"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

const mobileLinks = [
  { name: "Introduction", href: "/docs" },
  { name: "Features", href: "/docs/features" },
  { name: "Getting Started", href: "/docs/getting-started" },
  { name: "Channel Model", href: "/docs/channels" },
  { name: "Governance Rules", href: "/docs/governance-rules" },
  { name: "API Reference", href: "/docs/api-reference" },
  { name: "Licensing", href: "/docs/licensing" },
  { name: "Roadmap", href: "/docs/roadmap" },
];
export function DocsHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-md">
      <div className="flex items-center justify-between h-14 px-4 md:px-6">
        {/* Mobile: hamburger + logo */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          {/* Mobile logo (hidden on desktop — sidebar has its own) */}
          <Link href="/docs" className="md:hidden flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-black text-xs"
              style={{ background: "linear-gradient(135deg, #0D9488, #e69adfde)" }}
            >
              e7
            </div>
            <span className="text-base font-semibold text-white">event</span>
            <span className="text-base font-semibold text-teal-400">7</span>
            <span className="ml-1 text-[10px] font-medium text-slate-500 uppercase tracking-widest">
              docs
            </span>
          </Link>
        </div>

        {/* Right side CTAs */}
        <div className="flex items-center gap-3">
          <Link
            href="https://github.com/KTCrisis/event7"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            GitHub
            <ExternalLink className="h-3 w-3" />
          </Link>
          <Link
            href="/login"
            className="text-xs font-medium text-slate-300 hover:text-white px-3 py-1.5 rounded-md border border-slate-700 hover:border-slate-600 transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="text-xs font-medium text-slate-950 bg-teal-400 hover:bg-teal-300 px-3 py-1.5 rounded-md transition-colors"
          >
            Get started
          </Link>
        </div>
      </div>

      {/* Mobile nav drawer */}
      {mobileOpen && (
        <nav className="md:hidden border-t border-slate-800/60 bg-slate-950 px-4 py-3 space-y-1">
          {mobileLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "block px-3 py-2 rounded-md text-sm transition-colors",
                pathname === link.href
                  ? "bg-teal-500/10 text-teal-400 font-medium"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              )}
            >
              {link.name}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}