# -*- coding: utf-8 -*-
"""导出公开 H5 风格列表: 桌面端 localStorage 里的收藏 → web/data/public-styles.json

用法（在浏览器收藏好后运行）:
  cd web && python scripts/export_public_styles.py [styleId ...]
    - 无参数时交互提示从浏览器粘贴收藏 id（开发者工具 Console:
      localStorage.getItem('styleforge-favorites') 回车复制）
    - 或直接把 id 作为参数传入
输出: data/public-styles.json = ["transform-93", "transform-156", ...]
/m 页读取此文件决定公网可见的风格。
"""
import json, sys
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

WEB = Path(__file__).resolve().parent.parent
DATA = WEB / 'data'
OUT = DATA / 'public-styles.json'


def main():
    args = [a.strip() for a in sys.argv[1:] if a.strip()]
    if not args:
        print('未传参数。两种用法:')
        print('  1) python export_public_styles.py transform-93 transform-156 ...')
        print('  2) 打开网站任意页 → F12 → Console → 输入 localStorage.getItem("styleforge-favorites")')
        print('     把输出的 JSON 数组粘贴到这里回车:')
        raw = input('> ').strip()
        try:
            args = [x.strip() for x in json.loads(raw)]
        except Exception:
            # 容错: 用户可能粘贴了带引号的字符串数组
            raw = raw.strip('"\'')
            try:
                args = [x.strip() for x in json.loads(raw)]
            except Exception:
                print('!! 无法解析，退出'); return
    # 只保留合法 id 格式
    ids = [a for a in args if a.startswith(('transform-', 'generate-'))]
    if not ids:
        print('!! 没有合法的风格 id（需要 transform-XX / generate-XX 格式）')
        return
    DATA.mkdir(exist_ok=True)
    OUT.write_text(json.dumps(sorted(set(ids)), ensure_ascii=False, indent=1), encoding='utf-8')
    print(f'已写入 {OUT.name}: {len(ids)} 个公开风格')
    print('  ->', ', '.join(ids))


if __name__ == '__main__':
    main()
