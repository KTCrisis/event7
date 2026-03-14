// src/app/docs/layout.tsx
// Docs layout — sidebar, header, content, footer.
// v2: Added DocsFooter.
// Placement: frontend/src/app/docs/layout.tsx

import { DocsSidebar } from "@/components/docs/docs-sidebar";
import { DocsHeader } from "@/components/docs/docs-header";
import { DocsFooter } from "@/components/docs/docs-footer";

export const metadata = {
  title: "Documentation — event7",
  description:
    "event7 documentation — Universal Schema Registry governance for Confluent, Apicurio and beyond.",
};

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-slate-950 text-slate-200">
      {/* Desktop sidebar */}
      <DocsSidebar />

      {/* Main content */}
      <div className="flex flex-1 flex-col min-w-0">
        <DocsHeader />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-6 py-10 md:py-14">
            {children}
          </div>
          <DocsFooter />
        </main>
      </div>
    </div>
  );
}