import { useCallback, useEffect, useState } from "react";
import { useI18n } from "../i18n.tsx";
import { useApp } from "../ctx.tsx";
import { supabase } from "../lib/supabase.ts";
import { Icon } from "./Icon.tsx";

export interface Project { id: string; title: string; abstract: string; updated_at: string }

/** Đề tài (abstract) đã lưu: chọn lại nhanh, và là căn cứ để gom lịch sử trích dẫn theo đề tài/luận văn. Chỉ lưu khi người dùng bấm Lưu. */
export default function ProjectPicker({ title, abstract, projectId, onPick, onSaved }: {
  title: string; abstract: string; projectId: string; onPick: (p: Project | null) => void; onSaved: (id: string, title: string) => void;
}) {
  const { t } = useI18n();
  const { session, toast } = useApp();
  const [list, setList] = useState<Project[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from("projects").select("id,title,abstract,updated_at").order("updated_at", { ascending: false }).limit(50);
    setList((data ?? []) as Project[]);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const cur = list.find((p) => p.id === projectId);
  const dirty = !!cur && (cur.abstract !== abstract || cur.title !== title);

  async function save() {
    if (!session || abstract.trim().length < 40) return;
    const name = (title.trim() || abstract.trim().split(/\s+/).slice(0, 8).join(" ")).slice(0, 120);
    setBusy(true);
    if (cur) {
      const { error } = await supabase.from("projects").update({ title: name, abstract, updated_at: new Date().toISOString() }).eq("id", cur.id);
      if (error) toast(error.message, "err"); else { toast(t("proj_updated")); onSaved(cur.id, name); }
    } else {
      const { data, error } = await supabase.from("projects").insert({ user_id: session.user.id, title: name, abstract }).select("id").single();
      if (error) toast(error.message, "err"); else { toast(t("proj_saved")); onSaved(data.id, name); }
    }
    setBusy(false); void load();
  }
  async function remove() {
    if (!cur || !confirm(t("proj_confirm_delete"))) return;
    const { error } = await supabase.from("projects").delete().eq("id", cur.id);
    if (error) toast(error.message, "err"); else { onPick(null); void load(); }
  }

  return (
    <div className="projects">
      <label className="grow">{t("proj_saved_h")}
        <select value={projectId} onChange={(e) => onPick(list.find((p) => p.id === e.target.value) ?? null)}>
          <option value="">{t("proj_new")}</option>
          {list.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
      </label>
      <div className="row wrap">
        <button className="btn sm" onClick={save} disabled={busy || abstract.trim().length < 40}><Icon name="check" size={14} /> {cur ? (dirty ? t("proj_update") : t("proj_saved_ok")) : t("proj_save")}</button>
        {cur && <button className="btn sm ghost" onClick={remove}><Icon name="trash" size={14} /> {t("delete")}</button>}
      </div>
      <p className="muted small">{t("proj_note")}</p>
    </div>
  );
}
