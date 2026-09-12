import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { SiteNav } from "@/components/site-nav";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="group flex items-baseline gap-2">
          <span className="font-serif text-lg font-black tracking-wide">
            StyleForge
          </span>
          <span className="hidden text-xs tracking-index text-muted-foreground sm:inline">
            提示词海报工坊
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <SiteNav />
          <Link
            href="/create"
            className={buttonVariants({
              size: "sm",
              className: "ml-2 hidden font-medium sm:inline-flex",
            })}
          >
            开始创作
          </Link>
        </div>
      </div>
    </header>
  );
}
