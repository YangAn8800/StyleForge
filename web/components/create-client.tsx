/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TunnelImg } from "@/components/tunnel-img";
import { type AspectRatio, ASPECT_SIZES } from "@/lib/generate";
import { startRun, getRun, subscribeRun, clearRun, type RunTaskInit, type RunResult } from "@/lib/run-manager";
import { useFavorites } from "@/lib/use-favorites";
import { useHistory } from "@/lib/use-history";
import { styles, type StyleItem } from "@/lib/styles";

interface Result {
  styleId: string;
  styleName: string;
  imageUrl: string;
  thumbUrl?: string;
  real?: boolean;
  notice?: string;
}

const MAX_STYLES = 3;

const ASPECTS: Array<{ key: AspectRatio; label: string; hint: string }> = [
  { key: "3:4", label: "3:4 竖版", hint: "与模板上下对照版式一致，推荐" },
  { key: "1:1", label: "1:1 方形", hint: "方形构图，对照结构可能被压缩" },
  { key: "16:9", label: "16:9 横版", hint: "横版画面，对照版式可能变为左右" },
];

export function CreateClient({ initialStyleId, initialPrompt }: { initialStyleId?: string; initialPrompt?: string }) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>(
    initialStyleId ? [initialStyleId] : [],
  );
  const [customPrompt, setCustomPrompt] = useState<string>(initialPrompt ?? "");
  const [aspect, setAspect] = useState<AspectRatio>("3:4");
  const [styleQuery, setStyleQuery] = useState("");
  // 生图任务交给顶层 run-manager 托管：刷新、切走页面再回来，进程仍在跑（仍在显示"生成中"）
  const [, force] = useState(0);
  useEffect(() => subscribeRun(() => force((x) => x + 1)), []);
  const run = getRun();
  const status: "idle" | "generating" | "done" = !run ? "idle" : run.status;
  const progress = run?.progressText ?? "";
  const results = (run?.results ?? []) as Result[];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<string | null>(null);
  // 压缩后的 dataURL 放 state（不是 ref）：它在 img.onload 里异步算出，
  // 写 ref 不触发重渲染，按钮的可点状态会滞后。
  const [photoData, setPhotoData] = useState<string | null>(null);
  const { favs } = useFavorites();
  const history = useHistory();

  // 右侧风格列表：搜索过滤 + 收藏置顶分组
  const { favList, restList } = useMemo(() => {
    const q = styleQuery.trim().toLowerCase();
    const match = (s: StyleItem) =>
      !q ||
      s.name.toLowerCase().includes(q) ||
      s.num.includes(q) ||
      s.tags.some((t) => t.toLowerCase().includes(q));
    const favList = styles.filter((s) => favs.has(s.id) && match(s));
    const restList = styles.filter((s) => !favs.has(s.id) && match(s));
    return { favList, restList };
  }, [styleQuery, favs]);

  const aspectHint = ASPECTS.find((a) => a.key === aspect)?.hint;

  const handleFile = useCallback((file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    if (photoRef.current) URL.revokeObjectURL(photoRef.current);
    const url = URL.createObjectURL(file);
    photoRef.current = url;
    setPhotoUrl(url);
    setPhotoData(null); // 换图时先置空，避免用上一张的旧数据提交
    // 压缩转 dataURL（最长边 1280），控制生图请求体积
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      setPhotoData(canvas.toDataURL("image/jpeg", 0.9));
    };
    img.src = url;
    // 换图：清掉旧的运行（结果/进度都跟着消失），UI 回到 idle
    clearRun();
  }, []);

  const toggleStyle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length >= MAX_STYLES
          ? prev
          : [...prev, id],
    );
  };

  const generate = () => {
    const hasCustom = customPrompt.trim().length >= 20;
    if (!photoData || (selected.length === 0 && !hasCustom)) return;
    // 任务列表：自定义提示词（若有）+ 已选风格
    const tasks: RunTaskInit[] = [];
    if (hasCustom) {
      tasks.push({ key: "custom", name: "自定义拼装提示词", prompt: customPrompt.trim() });
    }
    for (const id of selected) {
      const s = styles.find((x) => x.id === id)!;
      tasks.push({ key: id, name: s.name, styleId: id, coverUrl: s.cover });
    }
    startRun({ photoData, aspect, tasks });
  };

  return (
    <div className="pb-16">
      <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
        {/* 左列：上传 + 结果 */}
        <div>
          {/* 自定义提示词（来自拼装页） */}
          {customPrompt.trim().length >= 20 && (
            <div className="mb-4 rounded-sm border border-primary/40 bg-primary/5 p-4">
              <div className="flex items-center justify-between">
                <p className="font-serif text-sm font-bold text-primary">
                  ✎ 自定义拼装提示词（{customPrompt.length} 字）
                </p>
                <button
                  onClick={() => setCustomPrompt("")}
                  className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  移除
                </button>
              </div>
              <p className="mt-2 max-h-24 overflow-y-auto whitespace-pre-wrap text-xs leading-5 text-muted-foreground">
                {customPrompt}
              </p>
            </div>
          )}

          {/* 上传区 */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFile(e.dataTransfer.files?.[0]);
            }}
            onClick={() => fileInputRef.current?.click()}
            className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center rounded-sm border-2 border-dashed border-border bg-card transition-colors hover:border-primary/50"
          >
            {photoUrl ? (
              <img
                src={photoUrl}
                alt="上传的照片"
                className="h-full w-full rounded-sm object-contain p-2"
              />
            ) : (
              <div className="text-center">
                <p className="font-serif text-lg font-bold">把照片拖到这里</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  或点击选择文件 · 建议 3:4 竖版、主体完整
                </p>
                <span className="mt-4 inline-block rounded-sm border border-border bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:border-primary/50 hover:text-primary">
                  选择本地照片
                </span>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </div>
          {photoUrl && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="mt-2 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              更换照片
            </button>
          )}

          {/* 比例选择 */}
          <div className="mt-4 rounded-sm border border-border bg-card p-4">
            <div className="flex items-baseline justify-between">
              <h3 className="font-serif text-sm font-bold">输出比例</h3>
              <span className="text-xs text-muted-foreground">{ASPECT_SIZES[aspect]}</span>
            </div>
            <div className="mt-2 flex gap-2">
              {ASPECTS.map((a) => (
                <button
                  key={a.key}
                  onClick={() => setAspect(a.key)}
                  aria-pressed={aspect === a.key}
                  className={`flex-1 rounded-sm border px-3 py-2 text-sm transition-colors ${
                    aspect === a.key
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
            {aspect !== "3:4" && (
              <p className="mt-2 text-xs text-amber-700">
                ⚠ {aspectHint}（模板提示词按 3:4 上下对照设计，比例仅改变画布尺寸）
              </p>
            )}
          </div>

          {/* 生成中 / 结果 */}
          {status === "generating" && (
            <div className="mt-6 rounded-sm border border-border bg-card p-5">
              <p className="font-serif font-bold text-primary">生成中…</p>
              <p className="mt-1 text-sm text-muted-foreground">{progress}</p>
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-secondary">
                <div className="h-full w-1/3 animate-pulse rounded-full bg-primary" />
              </div>
            </div>
          )}

          {results.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-4 font-serif text-xl font-bold">
                生成结果
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  上原片 · 下风格化
                </span>
              </h2>
              <div className="grid gap-6 sm:grid-cols-2">
                {results.map((r) => (
                  <ResultCard
                    key={r.styleId + r.imageUrl}
                    result={r}
                    aspect={aspect}
                  />
                ))}
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                {results.some((r) => r.real)
                  ? "* 由 gpt-image-1 图生图真实生成（1024×1536）"
                  : "* 未配置 OPENAI_API_KEY，当前为样例图回退展示；在 web/.env.local 填入密钥后即为真实生成"}
              </p>
            </section>
          )}

          {history.ready && history.items.length > 0 && (
            <section className="mt-10">
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="font-serif text-xl font-bold">
                  最近生成
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    共 {history.items.length} 张 · 已保存在本机
                  </span>
                </h2>
                <Link
                  href="/history"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  查看全部 →
                </Link>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {history.items.slice(0, 10).map((it) => (
                  <Link
                    key={it.image}
                    href={`/styles/${it.styleId}`}
                    className="relative block w-24 shrink-0 overflow-hidden rounded-sm border border-border"
                    title={`${it.styleName} · ${new Date(it.ts).toLocaleString()}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={it.image}
                      alt={it.styleName}
                      loading="lazy"
                      className="aspect-[3/4] w-full bg-secondary object-cover"
                    />
                    <span className="absolute bottom-0 left-0 right-0 truncate bg-black/55 px-1 py-0.5 text-[10px] text-white">
                      {it.styleName}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* 右列：风格选择 */}
        <aside>
          <div className="sticky top-20 rounded-sm border border-border bg-card p-4">
            <div className="flex items-baseline justify-between">
              <h2 className="font-serif font-bold">选择风格</h2>
              <span className="text-xs text-muted-foreground">
                最多 {MAX_STYLES} 个
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              可以多选，一次拿到多种风格的海报
            </p>

            {/* 风格搜索 */}
            <div className="mt-3 flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 focus-within:ring-2 focus-within:ring-ring">
              <span className="text-sm text-muted-foreground">⌕</span>
              <input
                value={styleQuery}
                onChange={(e) => setStyleQuery(e.target.value)}
                placeholder="搜索风格 / 标签 / 编号…"
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              {styleQuery && (
                <button
                  onClick={() => setStyleQuery("")}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="清空搜索"
                >
                  ×
                </button>
              )}
            </div>

            <div className="mt-3 max-h-[420px] overflow-y-auto pr-1">
              {favList.length > 0 && (
                <div className="mb-2">
                  <p className="mb-1.5 flex items-center gap-1 text-xs font-bold text-amber-600">
                    ★ 我的收藏（{favList.length}）
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {favList.map((s) => (
                      <StyleOption
                        key={s.id}
                        style={s}
                        active={selected.includes(s.id)}
                        onClick={() => toggleStyle(s.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
              <div>
                {favList.length > 0 && (
                  <p className="mb-1.5 text-xs font-bold text-muted-foreground">
                    全部风格{styleQuery ? ` · 匹配 ${restList.length}` : ""}
                  </p>
                )}
                <div className="grid grid-cols-3 gap-2">
                  {restList.map((s) => (
                    <StyleOption
                      key={s.id}
                      style={s}
                      active={selected.includes(s.id)}
                      onClick={() => toggleStyle(s.id)}
                    />
                  ))}
                </div>
                {favList.length + restList.length === 0 && (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    没有匹配的风格
                  </p>
                )}
              </div>
            </div>
            <Button
              className="mt-4 w-full font-medium"
              size="lg"
              disabled={
                !photoData ||
                (selected.length === 0 && customPrompt.trim().length < 20) ||
                status === "generating"
              }
              onClick={generate}
            >
              {status === "generating"
                ? "生成中…"
                : `生成海报（${
                    selected.length + (customPrompt.trim().length >= 20 ? 1 : 0) || "未选"
                  } 个任务）`}
            </Button>
            {!photoUrl && (
              <p className="mt-2 text-center text-xs text-muted-foreground">
                请先上传一张照片
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function StyleOption({
  style,
  active,
  onClick,
}: {
  style: StyleItem;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={style.name}
      className={`relative overflow-hidden rounded-sm border-2 transition-all ${
        active
          ? "border-primary shadow-md"
          : "border-transparent opacity-80 hover:opacity-100"
      }`}
    >
      <img
        src={style.cover}
        alt={style.name}
        className="aspect-[3/4] w-full object-cover"
      />
      <span className="absolute bottom-0 left-0 right-0 truncate bg-black/55 px-1 py-0.5 text-[10px] text-white">
        NO.{style.num} {style.name}
      </span>
      {active && (
        <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
          ✓
        </span>
      )}
    </button>
  );
}

function ResultCard({ result, aspect }: { result: Result; aspect: AspectRatio }) {
  // 容器比例对齐服务端真实输出：3:4→1024×1536(2:3)、1:1→1024、16:9→1536×1024(3:2)
  const ratioClass =
    aspect === "1:1" ? "aspect-square" : aspect === "16:9" ? "aspect-[3/2]" : "aspect-[2/3]";
  return (
    <div className="overflow-hidden rounded-sm border border-border bg-card">
      <div className="flex items-center justify-between px-3 py-2">
        <Badge className="font-serif tracking-index">NO.{result.styleId}</Badge>
        <span className="truncate font-serif text-sm font-bold">
          {result.styleName}
          {result.real === false && (
            <span className="ml-1 text-[10px] font-normal text-muted-foreground">
              （样例）
            </span>
          )}
        </span>
      </div>
      {result.imageUrl && (
        /* 生成图本身是「上原片 / 下风格化」合成图，按原始比例整图直出，不再拆分变形；
           TunnelImg 在隧道丢包导致加载失败时自动重试 */
        <TunnelImg
          src={result.imageUrl}
          alt={result.styleName}
          className={`${ratioClass} w-full`}
        />
      )}
      <div className="flex gap-2 p-3">
        <a
          href={result.imageUrl}
          download={`promptposter-no${result.styleId}.jpg`}
          className="inline-flex flex-1 items-center justify-center rounded-sm border border-border bg-background px-3 py-1.5 text-sm transition-colors hover:bg-secondary"
        >
          下载海报
        </a>
        <Link
          href={`/styles/${result.styleId}`}
          className="inline-flex flex-1 items-center justify-center rounded-sm border border-border bg-background px-3 py-1.5 text-sm transition-colors hover:bg-secondary"
        >
          查看风格
        </Link>
      </div>
    </div>
  );
}
