/**
 * 拼装引擎：selection -> { prompt, spans, notices }
 * 纯函数、零依赖前端框架，服务端/客户端/测试均可直接调用。
 * spans 输出与 PromptViewer 对齐，实现「拼出来即彩色」。
 */
import {
  BACKBONE, PHOTO_KEEP, REBUILD_LEAD, TAIL, SLOTS, RULES,
  type Option,
} from "./compose-slots";

export interface Selection {
  style?: string;
  color?: string;
  text?: string;
  mood?: string[];
  avoid?: string[];
  texture?: string[];
}

export interface ComposeSpan {
  start: number;
  end: number;
  cat: Option["cat"];
}

export interface ComposeResult {
  prompt: string;
  spans: ComposeSpan[];
  notices: string[];
}

const findOption = (slotId: string, optionId: string): Option | undefined =>
  SLOTS.find((s) => s.id === slotId)?.options.find((o) => o.id === optionId);

export function compose(sel: Selection): ComposeResult {
  const notices: string[] = [];

  // 1) 应用联动/互斥规则
  let { style, color, text, mood = [], avoid = [] } = sel;
  for (const rule of RULES) {
    if (rule.when.slot !== "style" || rule.when.option !== style) continue;
    if (rule.force && rule.force.slot === "text" && text !== rule.force.option) {
      text = rule.force.option;
      notices.push(rule.note);
    }
    if (rule.forbid) {
      for (const f of rule.forbid) {
        if (f.slot === "color" && color === f.option) {
          color = undefined;
          notices.push(rule.note);
        }
        if (f.slot === "mood") mood = mood.filter((m) => m !== f.option);
        if (f.slot === "avoid") avoid = avoid.filter((a) => a !== f.option);
      }
    }
  }

  // 2) 逐段拼接并记录区间
  const paragraphs: Array<{ body: string; cat?: Option["cat"] }> = [];
  paragraphs.push({ body: BACKBONE });
  paragraphs.push({ body: PHOTO_KEEP });

  const styleOpt = style ? findOption("style", style) : undefined;
  if (styleOpt) {
    paragraphs.push({ body: REBUILD_LEAD + styleOpt.body, cat: "style" });
  }

  // 质感媒介（多选叠加）
  const textures = (sel.texture ?? [])
    .map((t) => findOption("texture", t))
    .filter((o): o is Option => !!o);
  if (textures.length > 0) {
    paragraphs.push({
      body: "质感表现：" + textures.map((o) => o.body).join(""),
      cat: "texture",
    });
  }

  const colorOpt = color ? findOption("color", color) : undefined;
  if (colorOpt) paragraphs.push({ body: colorOpt.body, cat: "color" });

  const textOpt = text ? findOption("text", text) : undefined;
  if (textOpt) paragraphs.push({ body: textOpt.body, cat: "text" });

  for (const m of mood) {
    const o = findOption("mood", m);
    if (o) paragraphs.push({ body: o.body, cat: "mood" });
  }

  const avoids = avoid
    .map((a) => findOption("avoid", a))
    .filter((o): o is Option => !!o);
  if (avoids.length > 0) {
    paragraphs.push({
      body: "避免：" + avoids.map((o) => o.body.replace(/^避免?[:：]?/, "").replace(/。$/, "")).join("；") + "。",
      cat: "avoid",
    });
  }

  paragraphs.push({ body: TAIL });

  // 3) 生成文本与 spans
  let prompt = "";
  const spans: ComposeSpan[] = [];
  paragraphs.forEach((p, i) => {
    if (i > 0) prompt += "\n\n";
    const start = prompt.length;
    prompt += p.body;
    if (p.cat) spans.push({ start, end: prompt.length, cat: p.cat });
  });

  return { prompt, spans, notices };
}
