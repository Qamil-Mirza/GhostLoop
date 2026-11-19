// GhostLoop promo v6: cuts Higgsfield-generated 3D hero shots (Kling 3.0 Turbo, see v6/README.md) together with the
// product beats of the v5 GSAP film, renders the caption and end-card overlays from overlay.html, builds the score
// (v6/score.py) against the same timeline, and muxes output/ghostloop-promo-v6.mp4.
// Usage: node promo/v6/compose.mjs [--stills]
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { resolve, dirname, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const promo = resolve(here, '..');
const out = resolve(promo, 'output', 'v6');
const clips = resolve(out, 'clips');
const FPS = 30;

// Film timeline. `src` is a file, `from`/`len` pick the part used (seconds), `xin` is the transition from the previous
// segment and how long it overlaps. Overlays are sampled from overlay.html over the segment's own time.
const SEGMENTS = [
  { id: 'A', src: resolve(clips, 'A.mp4'), from: 0.0, len: 4.4, overlay: 'capA' },
  { id: 'build', src: resolve(promo, 'output', 'picture-v5.mp4'), from: 0.0, len: 5.6, xin: ['fade', 0.4] },
  { id: 'B', src: resolve(clips, 'B.mp4'), from: 0.0, len: 4.6, overlay: 'capB', xin: ['circleopen', 0.5] },
  // The stuck-points counter only reaches 0 at v5 24.1 s, so hold the last frame to let the payoff land.
  { id: 'fix', src: resolve(promo, 'output', 'picture-v5.mp4'), from: 12.6, len: 11.9, hold: 0.9, xin: ['fadewhite', 0.4] },
  { id: 'C', src: resolve(clips, 'C.mp4'), from: 0.0, len: 3.6, xin: ['zoomin', 0.3] },
  { id: 'D', src: resolve(clips, 'D.mp4'), from: 0.0, len: 5.0, hold: 1.2, overlay: 'end', xin: ['fade', 0.5] },
];
// xfade needs at least a frame of overlap (a shorter one silently ends the chain), so every cut is a real transition.
for (const s of SEGMENTS.slice(1)) if (!s.xin || s.xin[1] < 2 / FPS) throw new Error(`Segment ${s.id} needs an xin of at least 2 frames`);
let t = 0;
for (const [i, s] of SEGMENTS.entries()) {
  s.dur = +(s.len + (s.hold || 0)).toFixed(3);
  s.start = i === 0 ? 0 : +(t - (s.xin ? s.xin[1] : 0)).toFixed(3);
  t = s.start + s.dur;
}
const DURATION = +t.toFixed(3);
await mkdir(out, { recursive: true });
await writeFile(resolve(out, 'timeline.json'), JSON.stringify({ duration: DURATION, segments: SEGMENTS.map(({ id, from, len, dur, start }) => ({ id, from, len, dur, start })) }, null, 2));
console.log('Timeline', SEGMENTS.map(s => `${s.id}@${s.start}+${s.dur}`).join('  '), '=>', DURATION + 's');

const run = (cmd, args) => new Promise((ok, fail) => {
  const p = spawn(cmd, args, { stdio: ['ignore', 'inherit', 'inherit'] });
  p.on('close', c => c === 0 ? ok() : fail(new Error(`${cmd} exited ${c}`)));
});

// ---- Overlays: transparent PNG sequences rendered from overlay.html ----
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  try {
    const path = resolve(promo, '.' + decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!path.startsWith(promo + sep)) { res.writeHead(403); res.end(); return; }
    const body = await readFile(path);
    res.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream' }); res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/v6/overlay.html`);
  await page.evaluate(() => window.overlaysReady);
  for (const s of SEGMENTS.filter(s => s.overlay)) {
    const dir = resolve(out, 'overlays', s.overlay); await rm(dir, { recursive: true, force: true }); await mkdir(dir, { recursive: true });
    const n = Math.round(s.dur * FPS);
    for (let f = 0; f < n; f++) {
      await page.evaluate(([name, tt]) => window.renderAt(name, tt), [s.overlay, f / FPS]);
      await page.screenshot({ path: resolve(dir, String(f).padStart(4, '0') + '.png'), omitBackground: true });
    }
    console.log(`Overlay ${s.overlay}: ${n} frames`);
  }
  if (errors.length) throw new Error('Overlay page errors: ' + errors.join('; '));
} finally { await browser.close(); server.close(); }

// ---- Score ----
await run('python3', [resolve(here, 'score.py'), resolve(out, 'timeline.json'), resolve(out, 'score-v6.wav')]);

// ---- Picture: normalize every segment, burn overlays, chain transitions ----
const inputs = [], graph = [];
SEGMENTS.forEach((s, i) => {
  inputs.push('-i', s.src);
  const hold = s.hold ? `,tpad=stop_mode=clone:stop_duration=${s.hold}` : '';
  graph.push(`[${i}:v]trim=start=${s.from}:duration=${s.len},setpts=PTS-STARTPTS,fps=${FPS},scale=1920:1080:flags=lanczos,setsar=1,format=yuv420p${hold}[v${i}]`);
});
let ovIndex = SEGMENTS.length;
SEGMENTS.forEach((s, i) => {
  if (!s.overlay) { graph.push(`[v${i}]null[s${i}]`); return; }
  inputs.push('-framerate', String(FPS), '-i', resolve(out, 'overlays', s.overlay, '%04d.png'));
  graph.push(`[v${i}][${ovIndex++}:v]overlay=0:0:format=auto:eof_action=pass,format=yuv420p[s${i}]`);
});
let prev = 's0', acc = SEGMENTS[0].dur;
for (let i = 1; i < SEGMENTS.length; i++) {
  const s = SEGMENTS[i], [kind, d] = s.xin;
  const label = i === SEGMENTS.length - 1 ? 'vout' : `x${i}`;
  graph.push(`[${prev}][s${i}]xfade=transition=${kind}:duration=${d}:offset=${(acc - d).toFixed(3)}[${label}]`);
  acc = acc - d + s.dur; prev = label;
}
const picture = resolve(out, 'picture-v6.mp4');
await run('ffmpeg', ['-y', '-v', 'error', ...inputs, '-filter_complex', graph.join(';'), '-map', '[vout]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', String(FPS), picture]);

const final = resolve(promo, 'output', 'ghostloop-promo-v6.mp4');
await run('ffmpeg', ['-y', '-v', 'error', '-i', picture, '-i', resolve(out, 'score-v6.wav'), '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', final]);
const probed = await new Promise((ok, fail) => {
  const p = spawn('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', picture]); let s = '';
  p.stdout.on('data', d => s += d); p.on('close', c => c === 0 ? ok(+s) : fail(new Error('ffprobe failed')));
});
if (Math.abs(probed - DURATION) > 1.5 / FPS) throw new Error(`Picture is ${probed}s, timeline is ${DURATION}s`);
console.log('Wrote', final, `(${probed}s)`);
