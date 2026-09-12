import stylesData from "@/data/styles.json";

export type BoardType = "transform" | "generate";

export interface StyleItem {
  id: string;
  num: string;
  name: string;
  type: BoardType;
  cover: string;
  images: string[];
  prompt: string;
  tags: string[];
}

export interface BoardMeta {
  key: BoardType;
  label: string;
  en: string;
  desc: string;
}

export const boards: BoardMeta[] = [
  {
    key: "transform",
    label: "照片风格化",
    en: "PHOTO STYLE",
    desc: "上传一张照片，AI 按风格模板重绘——上半保留原片，下半变成艺术表达",
  },
  {
    key: "generate",
    label: "海报生成",
    en: "POSTER GEN",
    desc: "填一个主题，AI 从零生成完整海报——城市文旅、人物宣传等模板",
  },
];

export function boardLabel(type: string): string {
  return type === "generate" ? "海报生成" : "照片风格化";
}

export const styles: StyleItem[] = stylesData as StyleItem[];

export function getStyle(id: string): StyleItem | undefined {
  return styles.find((s) => s.id === id);
}

export function stylesByBoard(type: BoardType): StyleItem[] {
  return styles.filter((s) => s.type === type);
}

export function allTagsByBoard(type: BoardType): string[] {
  return [...new Set(stylesByBoard(type).flatMap((s) => s.tags))];
}

export const allTags: string[] = [
  ...new Set(styles.flatMap((s) => s.tags)),
];
