// Smooth organic SVG paths (Catmull-Rom through hand-placed points) for the backgrounds and the page transition.

type Point = readonly [number, number];

const fmt = (v: number): string => v.toFixed(1).replace(/0+$/, "").replace(/\.$/, "");

function segments(pts: readonly Point[], closedPath: boolean): string[] {
  const n = pts.length;
  const out: string[] = [];
  const count = closedPath ? n : n - 1;
  for (let i = 0; i < count; i += 1) {
    const p0 = closedPath || i > 0 ? pts[(i - 1 + n) % n] : pts[i];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = closedPath || i + 2 < n ? pts[(i + 2) % n] : p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    out.push(`C${fmt(c1[0])} ${fmt(c1[1])} ${fmt(c2[0])} ${fmt(c2[1])} ${fmt(p2[0])} ${fmt(p2[1])}`);
  }
  return out;
}

const closed = (pts: readonly Point[]): string => `M${fmt(pts[0][0])} ${fmt(pts[0][1])}${segments(pts, true).join("")}Z`;
const open = (pts: readonly Point[]): string => `M${fmt(pts[0][0])} ${fmt(pts[0][1])}${segments(pts, false).join("")}`;

// Hero: a pale band sweeping up to the right, and a row of orange hills along the bottom
export const HERO_BAND = closed([[-120, 560], [140, 330], [430, 430], [690, 200], [990, 270], [1240, 60], [1560, -80],
  [1560, 330], [1300, 430], [1060, 590], [760, 540], [520, 740], [250, 640], [-120, 930]]);
export const HERO_HILLS = closed([[-120, 1040], [-120, 780], [110, 650], [270, 790], [430, 570], [580, 720], [720, 540],
  [850, 700], [990, 610], [1120, 770], [1270, 650], [1560, 830], [1560, 1040]]);
export const HERO_RIDGE = closed([[-120, 1040], [-120, 900], [200, 820], [380, 900], [640, 790], [900, 880], [1180, 800],
  [1560, 930], [1560, 1040]]);

// The page transition: one fat squiggle that, drawn in full, covers the screen
export const SNAKE = open([[60, -80], [40, 250], [200, 470], [390, 270], [330, 90], [560, 40], [650, 330], [430, 560],
  [300, 800], [520, 1000], [730, 760], [700, 500], [880, 410], [1010, 620], [950, 900], [1110, 1160]]);

// Soft blobs for the questions and the "why" sections
export const BLOB_A = closed([[-80, 120], [160, -40], [420, 60], [520, 300], [360, 460], [120, 420], [-60, 330]]);
export const BLOB_B = closed([[900, 420], [1120, 300], [1380, 360], [1520, 560], [1420, 820], [1140, 860], [960, 700]]);
export const BLOB_C = closed([[560, 760], [760, 660], [900, 800], [820, 980], [600, 1000], [480, 900]]);
export const WHY_A = closed([[-100, 300], [180, 140], [420, 260], [380, 520], [140, 620], [-100, 560]]);
export const WHY_B = closed([[1040, 80], [1300, -40], [1540, 120], [1520, 420], [1280, 480], [1080, 340]]);
export const WHY_C = closed([[860, 640], [1120, 560], [1360, 700], [1300, 960], [980, 980], [820, 840]]);

// The curved line the tagline runs along
export const TAGLINE = open([[-200, 260], [120, 120], [480, 220], [820, 330], [1160, 170], [1500, 90], [1800, 220]]);
