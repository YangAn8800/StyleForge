"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const KEY = "styleforge-favorites";
/** 同页面跨组件广播（storage 事件只在其他标签页触发，同页不触发） */
const SYNC_EVENT = "styleforge-favorites-sync";

function readFavs(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch {
    /* 忽略损坏数据 */
  }
  return new Set();
}

/**
 * 收藏状态 hook：localStorage 持久化。
 * 同页面多实例（卡片星标 / 收藏分组 / 详情页按钮）通过自定义事件即时同步，
 * 跨标签页通过 storage 事件同步。
 */
export function useFavorites() {
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);
  const favsRef = useRef(favs);
  favsRef.current = favs;

  useEffect(() => {
    setFavs(readFavs());
    setReady(true);

    const apply = (raw: string | null) => {
      try {
        if (raw) setFavs(new Set(JSON.parse(raw) as string[]));
      } catch {}
    };
    // 同页面其他实例广播
    const onSync = (e: Event) => apply((e as CustomEvent).detail);
    // 其他标签页
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) apply(e.newValue);
    };
    window.addEventListener(SYNC_EVENT, onSync as EventListener);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(SYNC_EVENT, onSync as EventListener);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const persist = useCallback((next: Set<string>) => {
    setFavs(next);
    try {
      localStorage.setItem(KEY, JSON.stringify([...next]));
    } catch {}
    // 广播给同页面其他 hook 实例
    window.dispatchEvent(
      new CustomEvent(SYNC_EVENT, { detail: JSON.stringify([...next]) }),
    );
  }, []);

  const toggle = useCallback(
    (id: string) => {
      const cur = favsRef.current; // 用 ref 读最新值，避免闭包陈旧
      persist(
        new Set(cur.has(id) ? [...cur].filter((x) => x !== id) : [...cur, id]),
      );
    },
    [persist],
  );

  return { favs, toggle, ready };
}
