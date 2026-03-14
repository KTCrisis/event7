// src/components/docs/docs-footer.tsx
// Footer for the /docs layout — social links, quick doc links, copyright.
// Placement: frontend/src/components/docs/docs-footer.tsx

import Link from "next/link";
import { Github, Linkedin, Mail } from "lucide-react";

const docLinks = [
  { name: "Getting Started", href: "/docs/getting-started" },
  { name: "Features", href: "/docs/features" },
  { name: "API Reference", href: "/docs/api-reference" },
  { name: "Roadmap", href: "/docs/roadmap" },
  { name: "Licensing", href: "/docs/licensing" },
];

const conceptLinks = [
  { name: "Schema Validator", href: "/docs/validator" },
  { name: "Catalog", href: "/docs/catalog" },
  { name: "Channel Model", href: "/docs/channels" },
  { name: "AsyncAPI", href: "/docs/asyncapi" },
  { name: "Governance Rules", href: "/docs/governance-rules" },
];

export function DocsFooter() {
  return (
    <footer className="border-t border-slate-800/60 bg-slate-950/80">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="grid gap-8 sm:grid-cols-3">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-6 h-6 rounded flex items-center justify-center text-white font-black text-[9px]"
                style={{
                  background: "linear-gradient(135deg, #0D9488, #e69adfde)",
                }}
              >
                e7
              </div>
              <span className="text-sm font-semibold text-white">
                event<span className="text-teal-400">7</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed mb-4">
              Explore, validate, govern.
              <br />
              Universal schema registry governance.
            </p>
            <div className="flex items-center gap-2">
              <a
                href="https://github.com/KTCrisis/event7"
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-md text-slate-500 hover:text-white hover:bg-slate-800/50 transition-colors"
                title="GitHub"
              >
                <Github className="h-4 w-4" />
              </a>
              <a
                href="https://www.linkedin.com/in/marc-verchiani-83235b10/"
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-md text-slate-500 hover:text-white hover:bg-slate-800/50 transition-colors"
                title="LinkedIn"
              >
                <Linkedin className="h-4 w-4" />
              </a>
              <a
                href="mailto:flux7art@gmail.com"
                className="p-1.5 rounded-md text-slate-500 hover:text-white hover:bg-slate-800/50 transition-colors"
                title="Contact"
              >
                <Mail className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Doc links */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-3">
              Documentation
            </p>
            <ul className="space-y-1.5">
              {docLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-xs text-slate-400 hover:text-teal-400 transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Concept links */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-3">
              Concepts
            </p>
            <ul className="space-y-1.5">
              {conceptLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-xs text-slate-400 hover:text-teal-400 transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-8 pt-6 border-t border-slate-800/40 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[11px] text-slate-600">
            © {new Date().getFullYear()} event7 — Apache 2.0
          </p>
          <a
            href="mailto:flux7art@gmail.com?subject=event7%20demo%20access"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-slate-950 bg-teal-400 hover:bg-teal-300 transition-colors"
          >
            <Mail className="h-3 w-3" />
            Request Demo
          </a>
        </div>
      </div>
    </footer>
  );
}