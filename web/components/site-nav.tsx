"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "首页" },
  { href: "/styles", label: "风格库" },
  { href: "/compose", label: "定制提示词" },
  { href: "/create", label: "生成器" },
  { href: "/history", label: "我的海报" },
  { href: "/community", label: "作品广场" },
];

export function SiteNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 sm:gap-2">
      {items.map((item) => {
        const active =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-sm px-2 py-1.5 text-sm transition-colors sm:px-3 ${
              active
                ? "font-medium text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
