"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Github, Linkedin, Mail } from "lucide-react";
import { cn } from "@/lib/utils";

const mobileLinks = [
  { name: "Introduction", href: "/docs" },
  { name: "Features", href: "/docs/features" },
  { name: "Getting Started", href: "/docs/getting-started" },
  { name: "Self-Hosted Install", href: "/docs/installation" },
  { name: "Schema Validator", href: "/docs/validator" },
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
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <Link
            href="/docs"
            className="md:hidden flex items-center gap-2"
          >
            <div
              className="w-6 h-6 rounded flex items-center justify-center text-white font-black text-[9px]"
              style={{ background: "linear-gradient(135deg, #0D9488, #e69adfde)" }}
            >
              e7
            </div>
            <span className="text-sm font-semibold text-white">
              event<span className="text-teal-400">7</span>
            </span>
          </Link>
        </div>

        {/* Right: links */}
        <div className="flex items-center gap-1">
          <a
            href="https://github.com/KTCrisis/event7"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors"
            title="GitHub"
          >
            <Github className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">GitHub</span>
          </a>
          <a
            href="https://www.linkedin.com/in/marc-verchiani-83235b10/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors"
            title="LinkedIn"
          >
            <Linkedin className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">LinkedIn</span>
          </a>
          <a
            href="mailto:flux7art@gmail.com"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors"
            title="Contact"
          >
            <Mail className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Contact</span>
          </a>
          <div className="hidden sm:block w-px h-4 bg-slate-800 mx-1" />
          <a
            href="mailto:flux7art@gmail.com?subject=event7%20demo%20access"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-slate-950 bg-teal-400 hover:bg-teal-300 transition-colors"
          >
            Request Demo
          </a>
        </div>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <nav className="md:hidden border-t border-slate-800/60 bg-slate-950/95 backdrop-blur-md">
          <ul className="py-2 px-3 space-y-0.5">
            {mobileLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "block px-3 py-2 rounded-md text-sm transition-colors",
                      isActive
                        ? "bg-teal-500/10 text-teal-400 font-medium"
                        : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                    )}
                  >
                    {link.name}
                  </Link>
                </li>
              );
            })}
          </ul>
          {/* Mobile contact links */}
          <div className="border-t border-slate-800/60 px-3 py-3 flex items-center gap-3">
            <a
              href="https://github.com/KTCrisis/event7"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-white transition-colors"
            >
              <Github className="h-3.5 w-3.5" />
              GitHub
            </a>
            <a
              href="https://www.linkedin.com/in/marc-verchiani-83235b10/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-white transition-colors"
            >
              <Linkedin className="h-3.5 w-3.5" />
              LinkedIn
            </a>
            <a
              href="mailto:flux7art@gmail.com"
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-white transition-colors"
            >
              <Mail className="h-3.5 w-3.5" />
              Contact
            </a>
          </div>
        </nav>
      )}
    </header>
  );
}