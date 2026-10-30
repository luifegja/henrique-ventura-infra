"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { NAV } from "./nav";
import { Wordmark } from "@/components/brand/wordmark";
import { ThemeToggle } from "./theme-toggle";
import { cn } from "@/lib/utils";
import { prefersReducedMotion } from "@/lib/motion";

export function Sidebar({ userName, isAdmin }: { userName: string; isAdmin: boolean }) {
  const pathname = usePathname();
  const items = NAV.filter((item) => !item.adminOnly || isAdmin);
  const glide = useGlide(pathname, items.length);
  return (
    <aside className="sticky top-0 flex h-screen w-[208px] shrink-0 flex-col self-start border-r border-black/20 bg-spine text-spine-ink">
      <div className="px-4 pb-3 pt-4">
        <Wordmark className="text-spine-ink" />
      </div>

      <nav ref={glide.navRef} className="relative mt-1 min-h-0 flex-1 overflow-y-auto px-2" aria-label="Principal">
        {glide.box ? (
          <span
            aria-hidden
            className={cn("pointer-events-none absolute left-0 top-0 rounded border-l-2 border-accent bg-white/[0.07]", glide.box.animate && "transition-transform duration-3 ease-out")}
            style={{ transform: `translateY(${glide.box.top}px)`, left: glide.box.left, width: glide.box.width, height: glide.box.height }}
          />
        ) : null}
        <div className="mb-1 pt-2">
          <ul className="space-y-0.5">
            {items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex h-8 items-center gap-2.5 rounded border-l-2 px-2.5 text-sm text-spine-ink/75 duration-1 hover:bg-white/5 hover:text-spine-ink",
                      // Sem JS o item ativo pinta o próprio destaque; medido, o bloco deslizante assume.
                      active ? (glide.box ? "border-transparent text-spine-ink" : "border-spine-accent bg-white/[0.07] text-spine-ink") : "border-transparent",
                    )}
                  >
                    <item.icon className="size-4 shrink-0" aria-hidden />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      <div className="border-t border-white/10 px-3 py-3 text-xs">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm text-spine-ink">{userName}</div>
            <div className="text-spine-ink/55">{isAdmin ? "Administrador" : "Atendente"}</div>
          </div>
          <span className="flex items-center gap-1">
            <ThemeToggle />
          </span>
        </div>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="mt-2 inline-flex items-center gap-1.5 text-spine-ink/60 hover:text-spine-ink"
        >
          <LogOut className="size-3.5" aria-hidden /> Sair
        </button>
      </div>
    </aside>
  );
}

/**
 * O destaque do item ativo é um bloco só, que desliza até o item novo (M4). A
 * barra lateral vive no layout e não remonta ao navegar, então basta medir.
 */
function useGlide(pathname: string, itemCount: number) {
  const navRef = React.useRef<HTMLElement>(null);
  const [box, setBox] = React.useState<{ top: number; left: number; width: number; height: number; animate: boolean } | null>(null);
  React.useLayoutEffect(() => {
    const el = navRef.current?.querySelector<HTMLElement>('a[aria-current="page"]');
    setBox((prev) =>
      el ? { top: el.offsetTop, left: el.offsetLeft, width: el.offsetWidth, height: el.offsetHeight, animate: prev !== null && !prefersReducedMotion() } : null,
    );
  }, [pathname, itemCount]);
  return { navRef, box };
}
