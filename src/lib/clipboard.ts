/** Sao chép văn bản; kèm HTML (chữ nghiêng) để dán vào Word/Google Docs giữ nguyên định dạng. */
export async function copyRich(plain: string, html?: string): Promise<boolean> {
  try {
    if (html && "ClipboardItem" in window) {
      await navigator.clipboard.write([new ClipboardItem({
        "text/plain": new Blob([plain], { type: "text/plain" }),
        "text/html": new Blob([html], { type: "text/html" }),
      })]);
      return true;
    }
    await navigator.clipboard.writeText(plain);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = plain; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch { return false; }
  }
}
