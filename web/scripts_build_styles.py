# -*- coding: utf-8 -*-
"""扫描 skills 目录下的 组XX_风格名 文件夹，生成 styles.json 并拷贝样例图到 public/styles/"""
import json, re, shutil
from pathlib import Path

ROOT = Path(r"C:\Users\l\Desktop\skills")
COLLECTION = ROOT / "collection"   # 板块一：照片改造型（img2img）
GENERATION = ROOT / "generation"   # 板块二：原创生成型（txt2img）
WEB = ROOT / "web"
PUB = WEB / "public" / "styles"
OUT = WEB / "data" / "styles.json"

TAG_MAP = [
    ("羊毛毡", ["文创", "玩偶"]), ("蜡笔动物", ["手绘", "童趣"]), ("马克笔", ["插画", "色彩"]),
    ("极简版画", ["插画", "印刷"]), ("食物图鉴", ["手绘", "图鉴"]), ("布艺拼贴", ["文创", "拼贴"]),
    ("水彩贴纸", ["手绘", "手帐"]), ("橡皮图章", ["复古", "旅行"]), ("黑线涂鸦小人物新版", ["涂鸦", "趣味"]),
    ("韩式童趣", ["插画", "卡通"]), ("木刻童话", ["插画", "复古"]), ("极简扁平图解", ["插画", "极简"]),
    ("水彩人物小品", ["手绘", "速写"]), ("淡彩街景速写", ["手绘", "速写"]), ("剪纸", ["文创", "剪纸"]),
    ("纸艺", ["文创", "拼贴"]), ("错版", ["插画", "印刷"]),
    ("水墨", ["东方", "水墨"]), ("电影海报", ["摄影", "电影感"]), ("Pin", ["文创", "立体"]),
    ("几何", ["插画", "几何"]), ("涂鸦", ["涂鸦", "趣味"]), ("素描", ["手绘", "素描"]),
    ("油画", ["手绘", "油画"]), ("彩铅", ["手绘", "童趣"]), ("大头像", ["手绘", "童趣"]),
    ("蜡粉笔", ["手绘", "复古"]), ("等距", ["插画", "立体"]), ("韩式", ["插画", "卡通"]),
    ("贴片", ["插画", "杂志"]), ("手绘", ["手绘", "插画"]),
]

def scan_board(board_dir: Path, style_type: str, url_prefix: str):
    """扫描一个板块目录下的 组XX_风格名 文件夹，返回 styles 条目并拷贝图片"""
    out = []
    for folder in sorted(board_dir.iterdir()):
        m = re.match(r"组(\d+)_(.+)", folder.name)
        if not folder.is_dir() or not m:
            continue
        num, name = m.group(1), m.group(2)
        prompt_file = folder / "提示词.txt"
        prompt = prompt_file.read_bytes().decode("utf-8-sig").strip() if prompt_file.exists() else ""
        images = sorted(
            (f.name for f in folder.iterdir() if f.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp")),
        )
        tags = next((t for kw, t in TAG_MAP if kw in name), ["插画"])
        # 板块前缀目录，避免两个板块的相同编号互相覆盖
        dest = PUB / f"{style_type}-{num}"
        if dest.exists():
            shutil.rmtree(dest)
        dest.mkdir(parents=True)
        for img in images:
            shutil.copy2(folder / img, dest / img)
        out.append({
            "id": f"{style_type}-{num}", "num": num, "name": name, "type": style_type,
            "cover": f"/styles/{style_type}-{num}/{images[0]}" if images else "",
            "images": [f"/styles/{style_type}-{num}/{i}" for i in images],
            "prompt": prompt, "tags": tags,
        })
    return out


styles = scan_board(COLLECTION, "transform", "/styles") + scan_board(GENERATION, "generate", "/styles")

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(styles, ensure_ascii=False, indent=2), encoding="utf-8")
by_type = {}
for s in styles:
    by_type.setdefault(s["type"], []).append(s)
print(f"styles: {len(styles)} (transform 照片改造 {len(by_type.get('transform', []))} / generate 原创生成 {len(by_type.get('generate', []))})")
for s in by_type.get("generate", []):
    print(f"  [generate] 组{s['num']} {s['name']}: {len(s['images'])}张")
