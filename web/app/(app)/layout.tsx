import { requireAgent } from "@/lib/session";
import { Sidebar } from "@/components/layout/sidebar";
import { Providers } from "@/components/providers";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const agent = await requireAgent();
  return (
    <Providers>
      <div className="flex min-h-screen">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-accent-fill focus:px-3 focus:py-1.5 focus:text-sm focus:text-on-accent-fill"
        >
          Pular para o conteúdo
        </a>
        <Sidebar userName={agent.name} isAdmin={agent.role === "administrator"} />
        <main id="main" tabIndex={-1} className="min-w-0 flex-1 overflow-y-auto px-8 py-6">
          {children}
        </main>
      </div>
    </Providers>
  );
}
