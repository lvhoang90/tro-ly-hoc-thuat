// Cấu trúc bản chụp CSDL EduFind (data/edufind.ts, sinh bởi scripts/sync-edufind.mjs).
export interface EdufindDiscipline { slug: string; path: string; vi: string; en: string; year: number; decision: string }
export interface EdufindIntl { t: string; i: string[]; p: string; q: string; s: number | null; oa: boolean; d: number[] }
export interface EdufindDomestic { t: string; i: string[]; p: string; max: number; d: number }
export interface EdufindData {
  origin: string; generated: string;
  disciplines: EdufindDiscipline[]; intl: EdufindIntl[]; dom: EdufindDomestic[];
}
/** Địa chỉ trang của một lĩnh vực trên EduFind (hoặc cổng chung nếu không có). */
export const edufindUrl = (origin: string, path?: string) => `${origin}/${path ? path + "/" : ""}`;
