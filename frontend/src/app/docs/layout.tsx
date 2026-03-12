import { DocsSidebar } from "@/components/docs/docs-sidebar";
import { DocsHeader } from "@/components/docs/docs-header";

export const metadata = {
  title: "Documentation — event7",
  description:
    "event7 documentation — Universal schema registry governance for Confluent, Apicurio and beyond.",
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
        </main>
      </div>
    </div>
  );
}