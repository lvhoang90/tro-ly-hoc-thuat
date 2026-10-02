// Trích văn bản từ tệp .doc (định dạng Word cũ) vì trình duyệt không đọc được. Không lưu tệp.
// Giới hạn thân yêu cầu 4,5 MB của Vercel; tệp lớn hơn nên chuyển sang .docx hoặc PDF.
import WordExtractor from "word-extractor";
import { fail, json, requireUser } from "./_lib/common.ts";

export async function POST(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;
  const buf = Buffer.from(await request.arrayBuffer());
  if (buf.length < 100 || buf.length > 4_400_000) return fail("bad_request", 413, "Tệp .doc tối đa khoảng 4 MB. Hãy lưu thành .docx hoặc PDF.");
  try {
    const doc = await new WordExtractor().extract(buf);
    return json({ text: doc.getBody() });
  } catch {
    return fail("bad_request", 422, "Không đọc được tệp .doc.");
  }
}
