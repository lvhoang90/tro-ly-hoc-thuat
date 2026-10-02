// Nhận diện nhanh tiếng Anh/Việt ở trình duyệt hoặc máy chủ (không cần thư viện) để chặn sớm
// tài liệu ngôn ngữ khác. Kết quả cuối cùng vẫn do mô hình AI xác nhận.

const EN = new Set("the of and to in a is that for it as with was on be by this are or from at an which have has not but they their been were can more these also its our we than other into such may use used between".split(" "));
const VI_STOP = new Set("và của là các có được trong cho không một những này để với khi đã người từ theo như về tại hoặc cũng nhưng sẽ rất đến".split(" "));
const OTHER = new Set("le la les des du un une et est en dans pour que qui sur pas par au aux el los las del y es se por con una para como más der die das und ist nicht ein eine mit von zu den dem auf sich il lo di che per non sono um uma os dos não é com para".split(" "));
const VI_CHARS = /[ăâđêôơưàáạảãằắặẳẵầấậẩẫèéẹẻẽềếệểễìíịỉĩòóọỏõồốộổỗờớợởỡùúụủũừứựửữỳýỵỷỹ]/giu;

export type DetectedLang = "en" | "vi" | "other" | "unknown";

export function detectLang(text: string): DetectedLang {
  const sample = text.slice(0, 20000);
  const letters = sample.match(/\p{L}/gu) ?? [];
  if (letters.length < 200) return "unknown";
  const latin = sample.match(/\p{Script=Latin}/gu)?.length ?? 0;
  if (latin / letters.length < 0.6) return "other"; // CJK, Cyrillic, Arabic, Thái, Hàn...
  const words = sample.toLowerCase().match(/\p{L}+/gu) ?? [];
  let en = 0, vs = 0, ot = 0;
  for (const w of words) { if (EN.has(w)) en++; if (VI_STOP.has(w)) vs++; if (OTHER.has(w)) ot++; }
  const vc = (sample.match(VI_CHARS)?.length ?? 0) / letters.length;
  const enR = en / words.length, viR = vs / words.length;
  if (viR > 0.04 && vc > 0.03) return "vi";
  if (enR > 0.08) return "en";
  if (vc > 0.06 || viR > 0.07) return "vi";
  if (ot / words.length > 0.12 && enR < 0.06 && viR < 0.02) return "other"; // Pháp, Tây Ban Nha, Đức...
  if (enR < 0.03 && viR < 0.015) return "other";
  return "unknown";
}
