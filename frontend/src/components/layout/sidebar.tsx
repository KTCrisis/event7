// Placement: frontend/src/components/layout/sidebar.tsx
// Update: branded logo (event + 7 in teal) + collapsible sidebar + AI Agent
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Search,
  GitCompare,
  Share2,
  Library,
  FileCode,
  Bot,
  Settings,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";

const navigation = [
  {
    group: "Overview",
    items: [{ name: "Dashboard", href: "/", icon: LayoutDashboard }],
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
      { name: "AI Agent", href: "/ai", icon: Bot },
      { name: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`flex flex-col bg-card border-r border-border h-screen shrink-0 transition-all duration-200 ease-in-out ${
        collapsed ? "w-[52px]" : "w-60"
      }`}
    >
      {/* Logo + collapse toggle */}
      <div className="flex items-center justify-between p-4 mb-2">
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-black text-sm">
              e7
            </div>
            <span className="font-bold text-lg tracking-tight">
              event<span className="text-teal-400">7</span>
            </span>
          </div>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className={`text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-accent/50 ${
            collapsed ? "mx-auto" : ""
          }`}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 space-y-6 overflow-y-auto pb-6">
        {navigation.map((section) => (
          <div key={section.group}>
            {!collapsed && (
              <h3 className="px-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                {section.group}
              </h3>
            )}
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
                    title={collapsed ? item.name : undefined}
                    className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      collapsed ? "justify-center" : ""
                    } ${
                      isActive
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                    }`}
                  >
                    <item.icon size={16} className="shrink-0" />
                    {!collapsed && item.name}
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