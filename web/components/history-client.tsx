/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fetchJsonRetry } from "@/lib/net";

interface GalleryItem {
  image: string;
  thumb?: string;
  styleId: string;
  styleName: string;
  ts: number;
}

/**
 * 电脑端作品管理：显示服务端共享画廊的全部作品
 * （含观众扫码生成的），本机可单张删除（磁盘+台账）。
 */
export function HistoryClient() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<GalleryItem | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchJsonRetry<{ items?: GalleryItem[] }>("/api/gallery");
    setItems(Array.isArray(data?.items) ? data.items : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const remove = useCallback(
    async (img: string) => {
      if (!confirm("确定删除这张作品吗？（磁盘文件与记录一并删除）")) return;
      setBusy(img);
      try {
        const r = await fetch(`/api/gallery?img=${encodeURIComponent(img)}`, {
          method: "DELETE",
        });
        if (r.ok) {
          setItems((prev) => prev.filter((it) => it.image !== img));
        } else {
          const d = await r.json().catch(() => ({}));
          alert(`删除失败：${d.error ?? r.status}`);
        }
      } finally {
        setBusy(null);
      }
    },
    [],
  );

  // 按天分组
  const groups: Array<{ day: string; list: GalleryItem[] }> = [];
  for (const it of items) {
    const day = new Date(it.ts).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.list.push(it);
    else groups.push({ day, list: [it] });
  }

  if (loading) {
    return <p className="py-20 text-center text-sm text-muted-foreground">加载中…</p>;
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center py-20 text-center">
        <p className="font-serif text-2xl font-black">还没有作品</p>
        <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
          共享作品库是空的——你自己生成、或观众扫码生成的海报都会汇集到这里。
        </p>
        <Link
          href="/create"
          className={buttonVariants({ size: "lg", className: "mt-6 font-medium" })}
        >
          去生成 →
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-16">
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          共 {items.length} 张 · 共享作品库（含所有人生成）· 删除仅本机可用
        </p>
        <Button variant="outline" size="sm" onClick={load}>
          刷新
        </Button>
      </div>

      {groups.map((g) => (
        <section key={g.day} className="mb-10">
          <h2 className="mb-4 font-serif text-lg font-bold">
            {g.day}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {g.list.length} 张
            </span>
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {g.list.map((it) => (
              <div
                key={it.image}
                className="group relative overflow-hidden rounded-sm border border-border bg-card"
              >
                <button
                  onClick={() => setLightbox(it)}
                  className="block w-full"
                  title="点击放大"
                >
                  <img
                    src={it.thumb ?? it.image}
                    alt={it.styleName}
                    loading="lazy"
                    className="aspect-[3/4] w-full bg-secondary object-cover"
                  />
                </button>
                <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                  <Link
                    href={`/styles/${it.styleId}`}
                    className="truncate text-xs font-medium hover:text-primary"
                    title={it.styleName}
                  >
                    {it.styleName}
                  </Link>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {new Date(it.ts).toLocaleTimeString("zh-CN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <a
                    href={it.image}
                    download
                    className="rounded-sm bg-black/60 px-2 py-1 text-[10px] text-white hover:bg-black/80"
                  >
                    下载
                  </a>
                  <button
                    disabled={busy === it.image}
                    onClick={() => remove(it.image)}
                    className="rounded-sm bg-destructive/85 px-2 py-1 text-[10px] text-white hover:bg-destructive disabled:opacity-50"
                  >
                    {busy === it.image ? "删除中" : "删除"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      {/* 灯箱 */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}
        >
          <div
            className="relative max-h-full max-w-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightbox.image}
              alt={lightbox.styleName}
              className="max-h-[80vh] rounded-sm border border-border object-contain"
            />
            <div className="mt-3 flex items-center justify-between text-sm text-white">
              <span className="flex items-center gap-2">
                <Badge className="font-serif tracking-index">
                  {lightbox.styleId}
                </Badge>
                {lightbox.styleName}
                <span className="text-xs opacity-70">
                  {new Date(lightbox.ts).toLocaleString("zh-CN")}
                </span>
              </span>
              <span className="flex gap-3">
                <a href={lightbox.image} download className="underline underline-offset-2">
                  下载
                </a>
                <button
                  onClick={() => {
                    const img = lightbox.image;
                    setLightbox(null);
                    remove(img);
                  }}
                  className="underline underline-offset-2"
                >
                  删除
                </button>
                <button
                  onClick={() => setLightbox(null)}
                  className="underline underline-offset-2"
                >
                  关闭
                </button>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
