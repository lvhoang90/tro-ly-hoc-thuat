type Pair = [string, string];
export const REPO: string;
export const SITE: string;
export const SECTION_VI: Record<string, string>;
export const SECTION_ORDER: string[];
export const RELEASES: { version: string; date: string; title: Pair; summary: Pair; sections: Record<string, Pair[]>; notes: string[] }[];
