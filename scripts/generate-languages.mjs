// Builds profile/languages.svg: a pastel-yellow "most used languages" card
// from the language bytes of every public, non-fork repository you own.
import { writeFileSync, mkdirSync } from "node:fs";

const user = process.env.GITHUB_USER || "tynsoo";
const token = process.env.GITHUB_TOKEN;
const out = "profile/languages.svg";
const limit = 8;
const ignore = new Set(["Dockerfile", "Procfile", "Makefile"]);
const colors = ["#FBE7A1", "#FFF3B8", "#E8C766", "#FFFBE6", "#C9A227", "#F2D57E", "#FFF6CC", "#B8932E"];

const headers = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
if (token) headers.Authorization = `Bearer ${token}`;

async function api(path) {
  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (!res.ok) throw new Error(`GitHub API ${res.status} on ${path}: ${await res.text()}`);
  return res.json();
}

async function repos() {
  const all = [];
  for (let page = 1; ; page++) {
    const batch = await api(`/users/${user}/repos?type=owner&per_page=100&page=${page}`);
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all.filter(r => !r.fork && !r.archived && r.name.toLowerCase() !== user.toLowerCase());
}

const esc = s => String(s).replace(/[<>&"']/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]);

const totals = {};
for (const r of await repos()) {
  const langs = await api(`/repos/${r.full_name}/languages`);
  for (const [name, bytes] of Object.entries(langs)) {
    if (!ignore.has(name)) totals[name] = (totals[name] || 0) + bytes;
  }
}
const top = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, limit);
const sum = top.reduce((n, [, b]) => n + b, 0);
if (!sum) throw new Error("No language data found.");
const langs = top.map(([name, bytes], i) => ({ name, pct: (bytes / sum) * 100, color: colors[i % colors.length] }));

const W = 600, pad = 24, barW = W - pad * 2, barY = 62, rowH = 28, legendY = 100;
const H = legendY + Math.ceil(langs.length / 2) * rowH + 8;
let x = pad;
const bar = langs.map((l, i) => {
  const w = i === langs.length - 1 ? pad + barW - x : (barW * l.pct) / 100;
  const r = `<rect x="${x.toFixed(2)}" y="${barY}" width="${w.toFixed(2)}" height="12" fill="${l.color}"/>`;
  x += w;
  return r;
}).join("");
const legend = langs.map((l, i) => {
  const lx = pad + (i % 2) * (barW / 2), ly = legendY + Math.floor(i / 2) * rowH;
  return `<rect x="${lx}" y="${ly - 9}" width="10" height="10" fill="${l.color}"/><text x="${lx + 18}" y="${ly}" class="l">${esc(l.name)} <tspan class="p">${l.pct.toFixed(1)}%</tspan></text>`;
}).join("");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="t">
<title id="t">Most used languages</title>
<style>.h{font:700 20px 'Segoe UI',Ubuntu,Arial,sans-serif;fill:#FBE7A1}.l{font:400 13px 'Segoe UI',Ubuntu,Arial,sans-serif;fill:#C9D1D9}.p{fill:#8B949E}</style>
<rect width="${W}" height="${H}" rx="6" fill="#0D1117"/>
<text x="${pad}" y="38" class="h">Most Used Languages</text>
<clipPath id="c"><rect x="${pad}" y="${barY}" width="${barW}" height="12" rx="6"/></clipPath>
<g clip-path="url(#c)">${bar}</g>
${legend}
</svg>
`;
mkdirSync("profile", { recursive: true });
writeFileSync(out, svg);
console.log(`Wrote ${out}:`, langs.map(l => `${l.name} ${l.pct.toFixed(1)}%`).join(", "));
