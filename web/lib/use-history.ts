"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "styleforge-history";
const MAX = 200; // 上限防 localStorage 膨胀

export interface HistoryItem {
  /** 静态图路径 /generated/xxx.png */
  image: string;
  /** 风格 id，如 transform-93 */
  styleId: string;
  styleName: string;
  /** 原片 dataURL（仅当前会话有效，历史页可能丢失） */
  photo?: string;
  ts: number;
  real: boolean;
}

/** 生成历史 hook：元数据存 localStorage，图片本体在服务端 public/generated/ */
export function useHistory() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setItems(JSON.parse(raw) as HistoryItem[]);
    } catch {
      /* 忽略损坏数据 */
    }
    setReady(true);

    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY && e.newValue) {
        try {
          setItems(JSON.parse(e.newValue) as HistoryItem[]);
        } catch {}
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const persist = useCallback((next: HistoryItem[]) => {
    // 最近的在前；原片 dataURL 体积大，只保留最近 6 条的（够对比滑块用）
    const slim = next.slice(0, MAX).map((it, i) =>
      i < 6 ? it : { ...it, photo: undefined },
    );
    setItems(slim);
    try {
      localStorage.setItem(KEY, JSON.stringify(slim));
    } catch {
      // 配额溢出时丢弃原片重试
      try {
        localStorage.setItem(KEY, JSON.stringify(slim.map((it) => ({ ...it, photo: undefined }))));
      } catch {}
    }
  }, []);

  const add = useCallback(
    (item: HistoryItem) => persist([item, ...items]),
    [items, persist],
  );

  const remove = useCallback(
    (image: string) => persist(items.filter((it) => it.image !== image)),
    [items, persist],
  );

  const clear = useCallback(() => persist([]), [persist]);

  return { items, add, remove, clear, ready };
}
