import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config.ts";
import { localClient } from "./local-backend.ts";

/** Bản chạy trên máy chủ Node + SQLite (hosting dùng chung) thay vì Supabase: build với VITE_BACKEND=local. */
export const LOCAL = import.meta.env.VITE_BACKEND === "local";
export const configured = LOCAL || (!!SUPABASE_URL && !!SUPABASE_ANON_KEY);

// Khi chưa cấu hình, dùng giá trị giả để giao diện vẫn dựng được và hiển thị hướng dẫn thiết lập.
export const supabase: SupabaseClient = LOCAL
  ? (localClient as unknown as SupabaseClient)
  : createClient(SUPABASE_URL ?? "http://localhost:54321", SUPABASE_ANON_KEY ?? "anon", {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });

export interface Profile {
  id: string; email: string; full_name: string; title: string; affiliation: string; department: string; position: string;
  country: string; orcid: string; research_fields: string[]; keywords: string[]; bio: string; website: string;
  scholar_url: string; scopus_id: string; phone: string; role: "user" | "admin"; status: "active" | "suspended"; approved: boolean;
  bonus_credits: number; lifetime_used: number; created_at: string;
}

export interface Contact { email: string; phone: string; zalo: string; note_vi: string; note_en: string }
