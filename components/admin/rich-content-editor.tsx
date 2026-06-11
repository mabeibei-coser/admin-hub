"use client";

import { useRef, useEffect, useCallback } from "react";
import { ImagePlus } from "lucide-react";

interface Props {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

// 贴图前压缩上限：超过则等比缩到此边长，再导出 JPEG，避免 data URL 过大撑爆请求体/DB。
const MAX_DIM = 1280;

/** 把图片文件等比压缩并转成 data URL（统一 JPEG 0.85；法律文档配图多为截图/照片，透明极少）。 */
async function fileToScaledDataUrl(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = dataUrl;
  });
  let { width, height } = img;
  if (width > MAX_DIM || height > MAX_DIM) {
    const scale = Math.min(MAX_DIM / width, MAX_DIM / height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

/**
 * 极简富文本编辑器：contentEditable + 打字 + 贴图（粘贴或选文件）。
 * 输出 HTML 字符串，图片以压缩后的 data URL 内联（不依赖外部图床）。
 *
 * 受控但只在外部 value 与 DOM 不一致时回填 innerHTML（加载/重置场景），
 * 避免每次输入都重设 innerHTML 导致光标跳到开头。
 */
export function RichContentEditor({ value, onChange, disabled, placeholder }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el && el.innerHTML !== value) el.innerHTML = value || "";
  }, [value]);

  const emit = useCallback(() => {
    if (ref.current) onChange(ref.current.innerHTML);
  }, [onChange]);

  const insertImage = useCallback(
    (dataUrl: string) => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      document.execCommand("insertHTML", false, `<img src="${dataUrl}" alt="" />`);
      emit();
    },
    [emit]
  );

  const handlePaste = useCallback(
    async (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) insertImage(await fileToScaledDataUrl(file));
          return;
        }
      }
      // 纯文本/其它：交给浏览器默认粘贴行为
    },
    [insertImage]
  );

  const handlePickFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = ""; // 允许连续选同一文件
      if (file) insertImage(await fileToScaledDataUrl(file));
    },
    [insertImage]
  );

  return (
    <div className="rounded-xl border border-input bg-background overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-md border border-input bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-50 cursor-pointer transition-colors"
        >
          <ImagePlus className="size-3.5" /> 插入图片
        </button>
        <span className="text-[11px] text-muted-foreground">也可直接粘贴图片，会自动压缩后内嵌</span>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={handlePickFile} />
      </div>
      <div
        ref={ref}
        contentEditable={!disabled}
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={placeholder}
        onInput={emit}
        onPaste={handlePaste}
        data-placeholder={placeholder}
        className="rce-content min-h-64 max-h-[28rem] overflow-y-auto px-4 py-3 text-sm leading-relaxed text-foreground outline-none [&_img]:max-w-full [&_img]:rounded-md [&_img]:my-2 [&_p]:my-1"
      />
    </div>
  );
}
