"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CopyPromptButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          /* 剪贴板不可用时静默 */
        }
      }}
    >
      {copied ? "已复制 ✓" : "复制完整提示词"}
    </Button>
  );
}
