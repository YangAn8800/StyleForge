import tagsData from "@/data/tags.json";

export type TagCategory =
  | "layout" | "photo" | "style" | "color"
  | "text" | "texture" | "mood" | "avoid" | "base";

export interface CategoryMeta {
  label: string;
  color: string;
}

export const CATEGORY_META: Record<TagCategory, CategoryMeta> = {
  layout:  { label: "版式",     color: "#1d4ed8" },
  photo:   { label: "原片处理", color: "#0e7490" },
  style:   { label: "风格媒介", color: "#b23a26" },
  color:   { label: "色彩",     color: "#b45309" },
  text:    { label: "文字",     color: "#15803d" },
  texture: { label: "质感",     color: "#6d28d9" },
  mood:    { label: "情绪",     color: "#be185d" },
  avoid:   { label: "禁忌",     color: "#78716c" },
  base:    { label: "描述",     color: "#8a7a5c" },
};

export interface PromptSpan {
  start: number;
  end: number;
  cat: TagCategory;
  canon: string;
}

interface TagsFile {
  lexicon_version: number;
  groups: Record<
    string,
    { tags: Partial<Record<TagCategory, string[]>>; spans: PromptSpan[][]; coverage: number }
  >;
}

const typed = tagsData as unknown as TagsFile;

export function getGroupTags(id: string) {
  return typed.groups[id] ?? { tags: {}, spans: [], coverage: 0 };
}

export const lexiconVersion = typed.lexicon_version;
