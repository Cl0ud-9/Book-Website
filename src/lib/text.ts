// Small text helpers shared by the pages.

/** Lower case without accents, so a search for "bronte" finds Brontë (the catalogue does the same to what you type) */
export const plain = (s: string): string => s.toLowerCase().normalize("NFD").replace(/\p{Mn}/gu, "");

/** "Science fiction" -> "science-fiction", "Children’s" -> "childrens" */
export const slugify = (s: string): string =>
  s.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** "7 hours 24 minutes" -> "about 7 hours"; "1 hour 58 minutes" -> "about 2 hours"; "47 minutes" -> "about 47 minutes" */
export function about(readingTime: string): string {
  const hours = /(\d+) hours?/.exec(readingTime);
  const minutes = /(\d+) minutes?/.exec(readingTime);
  if (!hours) return `about ${readingTime}`;
  const n = Number(hours[1]) + (minutes && Number(minutes[1]) >= 30 ? 1 : 0);
  return `about ${n} hour${n !== 1 ? "s" : ""}`;
}

/** "7 hours 24 minutes" reads as "7 h 24 min" on a card */
export const shortTime = (readingTime: string): string =>
  readingTime.replace(" hours", " h").replace(" hour", " h").replace(" minutes", " min").replace(" minute", " min");

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
