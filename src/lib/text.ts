// Small text helpers shared by the pages.

/** Lower case without accents, so a search for "bronte" finds Brontë (the catalogue does the same to what you type) */
export const plain = (s: string): string => s.toLowerCase().normalize("NFD").replace(/\p{Mn}/gu, "");

/** "Science fiction" -> "science-fiction", "Children’s" -> "childrens" */
export const slugify = (s: string): string =>
  s.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

// A reading time is an estimate (people read at different speeds), so it is rounded to what it can honestly say: to
// 5 minutes under an hour, to half an hour up to 10 hours, and to the hour after that. Never "1 hour 58 minutes".
function rounded(minutes: number): { hours: number; half: boolean; mins: number } {
  if (minutes < 55) return { hours: 0, half: false, mins: Math.max(5, Math.round(minutes / 5) * 5) };
  if (minutes < 600) {
    const halves = Math.max(2, Math.round(minutes / 30));
    return { hours: Math.floor(halves / 2), half: halves % 2 === 1, mins: 0 };
  }
  return { hours: Math.round(minutes / 60), half: false, mins: 0 };
}

/** 118 -> "about 2 hours"; 137 -> "about 2½ hours"; 43 -> "about 45 minutes" */
export function about(minutes: number): string {
  const r = rounded(minutes);
  if (!r.hours) return `about ${r.mins} minutes`;
  return `about ${r.hours}${r.half ? "½" : ""} hour${r.hours > 1 || r.half ? "s" : ""}`;
}

/** The same on a card: "2 h", "2½ h", "45 min" */
export function shortTime(minutes: number): string {
  const r = rounded(minutes);
  return r.hours ? `${r.hours}${r.half ? "½" : ""} h` : `${r.mins} min`;
}

/** "about 2 hours" -> "About 2 hours" */
export const capital = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** A line as it is shown: in quotation marks unless it already has them, with an ellipsis where it begins or ends in
 * the middle of a sentence */
export function quoteText(text: string): string {
  let t = text.trim();
  if (/^\p{Ll}/u.test(t)) t = `…${t}`;
  if (/[:;,]$/.test(t)) t = `${t.slice(0, -1)}…`;
  return t.startsWith("“") ? t : `“${t}”`;
}

/** About 0.58 em a letter in heavy Rubik: a title's longest unbreakable word, in em, for .book-card__title's --fit
 * (written as the old builder wrote it: 6.0, 6.38) */
export function fit(title: string): string {
  const parts = title.split(/\s+/).flatMap((word) => {
    const pieces = word.split("-");
    return pieces.map((p, i) => p + (i < pieces.length - 1 ? "-" : ""));
  });
  const longest = Math.max(...parts.map((p) => p.length));
  const em = Math.round(Math.max(5.8, 0.58 * longest + 0.2) * 100) / 100;
  return Number.isInteger(em) ? em.toFixed(1) : String(em);
}

/** 121970 -> "121,970" */
export const thousands = (n: number): string => n.toLocaleString("en-US");

/** A four-pointed sparkle, drawn around 0 0 */
export const SPARKLE = "M0-10C1-3 3-1 10 0 3 1 1 3 0 10-1 3-3 1-10 0-3-1-1-3 0-10Z";

/** A starburst for badges and seals, in a 100 x 100 box */
export function burst(points = 14, r1 = 50, r2 = 40): string {
  const pts: string[] = [];
  for (let k = 0; k < points * 2; k += 1) {
    const r = k % 2 === 0 ? r1 : r2;
    const a = (Math.PI * k) / points - Math.PI / 2;
    pts.push(`${(50 + r * Math.cos(a)).toFixed(1)} ${(50 + r * Math.sin(a)).toFixed(1)}`);
  }
  return `M${pts.join("L")}Z`;
}
