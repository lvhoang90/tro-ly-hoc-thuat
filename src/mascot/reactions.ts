import type { Mood } from "./types.ts";

export type ScoreKey = "ami_score_hi" | "ami_score_mid" | "ami_score_lo";

/** Phản ứng của Ami theo điểm phù hợp: ≥80 mừng rỡ, ≥60 vui, dưới 60 quan tâm và động viên. */
export function scoreReaction(score: number): { key: ScoreKey; mood: Mood } {
  if (score >= 80) return { key: "ami_score_hi", mood: "celebrate" };
  if (score >= 60) return { key: "ami_score_mid", mood: "happy" };
  return { key: "ami_score_lo", mood: "care" };
}
