// Delivery rating submitted with the customer's verification: 1–5 whole
// stars and a short comment, both optional.

export const RATING_COMMENT_MAX = 1000;

export type RatingInput = { rating: number | null; comment: string | null };

export function parseRating(body: Record<string, unknown>): RatingInput | { error: string } {
  const r = body.rating;
  let rating: number | null = null;
  if (r !== undefined && r !== null) {
    if (typeof r !== "number" || !Number.isInteger(r) || r < 1 || r > 5) {
      return { error: "rating must be a whole number of stars from 1 to 5" };
    }
    rating = r;
  }
  const c = body.comment;
  let comment: string | null = null;
  if (c !== undefined && c !== null) {
    if (typeof c !== "string") return { error: "comment must be text" };
    const t = c.trim();
    if (t.length > RATING_COMMENT_MAX) {
      return { error: `comment must be at most ${RATING_COMMENT_MAX} characters` };
    }
    comment = t.length > 0 ? t : null;
  }
  if (comment && rating === null) return { error: "pick a star rating to go with your comment" };
  return { rating, comment };
}
