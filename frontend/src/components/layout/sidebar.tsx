// src/components/layout/sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Search,
  GitCompare,
  Library,
  FileCode,
  Share2,
  Settings,
} from "lucide-react";

const navigation = [
  {
    group: "Overview",
    items: [
      { name: "Dashboard", href: "/", icon: LayoutDashboard },
    ],
  },
  {
    group: "Schemas",
    items: [
      { name: "Explorer", href: "/schemas", icon: Search },
      { name: "Diff Viewer", href: "/diff", icon: GitCompare },
      { name: "References", href: "/references", icon: Share2 },
    ],
  },
  {
    group: "Business",
    items: [
      { name: "Catalog", href: "/catalog", icon: Library },
      { name: "AsyncAPI", href: "/asyncapi", icon: FileCode },
    ],
  },
  {
    group: "Admin",
    items: [
      { name: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex flex-col w-60 bg-card border-r border-border h-screen shrink-0">
      <div className="p-5 mb-2">
        <div className="flex items-center gap-3 font-bold text-lg">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-black text-sm">
            e7
          </div>
          <span>event7</span>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-6 overflow-y-auto pb-6">
        {navigation.map((section) => (
          <div key={section.group}>
            <h3 className="px-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
              {section.group}
            </h3>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      isActive
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                    }`}
                  >
                    <item.icon size={16} />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}