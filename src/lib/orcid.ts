// ORCID iD: kiểm tra định dạng + chữ số kiểm tra (ISO 7064 mod 11-2) và nhập thông tin từ API công khai của ORCID.
export function normalizeOrcid(s: string): string {
  const m = s.trim().replace(/^https?:\/\/(www\.)?orcid\.org\//i, "").replace(/\s|-/g, "").toUpperCase();
  return m.length === 16 ? `${m.slice(0, 4)}-${m.slice(4, 8)}-${m.slice(8, 12)}-${m.slice(12)}` : s.trim();
}

export function validOrcid(id: string): boolean {
  const d = id.replace(/-/g, "");
  if (!/^\d{15}[\dX]$/.test(d)) return false;
  let total = 0;
  for (let i = 0; i < 15; i++) total = (total + Number(d[i])) * 2;
  const r = (12 - (total % 11)) % 11;
  return d[15] === (r === 10 ? "X" : String(r));
}

export interface OrcidImport { full_name?: string; bio?: string; keywords?: string[]; affiliation?: string; country?: string; website?: string }

export async function importOrcid(id: string): Promise<OrcidImport> {
  const h = { Accept: "application/json" };
  const base = `https://pub.orcid.org/v3.0/${id}`;
  const [pr, er] = await Promise.all([fetch(`${base}/person`, { headers: h }), fetch(`${base}/employments`, { headers: h })]);
  if (!pr.ok) throw new Error("orcid");
  const p = await pr.json();
  const out: OrcidImport = {};
  const given = p.name?.["given-names"]?.value, family = p.name?.["family-name"]?.value;
  if (given || family) out.full_name = [family, given].filter(Boolean).join(" ").trim();
  if (p.biography?.content) out.bio = p.biography.content;
  out.keywords = (p.keywords?.keyword ?? []).map((k: { content: string }) => k.content).filter(Boolean);
  out.country = p.addresses?.address?.[0]?.country?.value;
  out.website = p["researcher-urls"]?.["researcher-url"]?.[0]?.url?.value;
  if (er.ok) {
    const e = await er.json();
    const s = e["affiliation-group"]?.[0]?.summaries?.[0]?.["employment-summary"];
    if (s?.organization?.name) out.affiliation = s.organization.name;
  }
  return out;
}
