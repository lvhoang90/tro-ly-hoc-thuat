/** Cảm xúc/trạng thái của nhân vật trợ lý Ami. */
export type Mood = "idle" | "wave" | "read" | "think" | "happy" | "celebrate" | "care" | "alert" | "sleep";

export interface FaceState { mood: Mood; blink: number; gx: number; gy: number; t: number; talk?: number }

/** Cảm xúc tạm thời tự quay về trạng thái nền sau một khoảng thời gian (giây). */
export const TRANSIENT: Partial<Record<Mood, { after: number; to: Mood }>> = {
  wave: { after: 2.8, to: "idle" },
  celebrate: { after: 3.2, to: "happy" },
};

/** Trạng thái hiệu lực tại thời điểm `elapsed` giây kể từ lúc đặt cảm xúc. */
export function effectiveMood(mood: Mood, elapsed: number): Mood {
  const tr = TRANSIENT[mood];
  return tr && elapsed > tr.after ? tr.to : mood;
}
