import { createClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config.ts";

export const configured = !!SUPABASE_URL && !!SUPABASE_ANON_KEY;

// Khi chưa cấu hình, dùng giá trị giả để giao diện vẫn dựng được và hiển thị hướng dẫn thiết lập.
export const supabase = createClient(SUPABASE_URL ?? "http://localhost:54321", SUPABASE_ANON_KEY ?? "anon", {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export interface Profile {
  id: string; email: string; full_name: string; title: string; affiliation: string; department: string; position: string;
  country: string; orcid: string; research_fields: string[]; keywords: string[]; bio: string; website: string;
  scholar_url: string; scopus_id: string; phone: string; role: "user" | "admin"; status: "active" | "suspended"; approved: boolean;
  bonus_credits: number; lifetime_used: number; created_at: string; ref_code?: string; referred_by?: string | null;
}

export interface Contact { email: string; phone: string; zalo: string; note_vi: string; note_en: string }
