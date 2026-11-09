// Usage: node render.js stills 1.0 2.5 ...   |   node render.js video out.mp4 [audio.wav]
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
(async () => {
  const [mode, ...args] = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('PAGE ERROR', e.message));
  await page.goto('file://' + path.resolve(__dirname, 'promo.html') + '?render=1');
  await page.evaluate(() => document.fonts.ready);
  if (mode === 'stills') {
    for (const t of args) {
      await page.evaluate(t => window.render(t), +t);
      await page.screenshot({ path: path.resolve(process.env.OUT || '.', `still_${(+t).toFixed(2)}.jpg`), type: 'jpeg', quality: 85 });
    }
  } else {
    const out = args[0], audio = args[1];
    const { DUR, FPS } = await page.evaluate(() => ({ DUR: window.DUR, FPS: window.FPS }));
    const N = Math.round(DUR * FPS);
    const ff = ['-y', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-'];
    if (audio) ff.push('-i', audio);
    ff.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart');
    if (audio) ff.push('-c:a', 'aac', '-b:a', '192k', '-shortest');
    ff.push(out);
    const p = spawn('ffmpeg', ff, { stdio: ['pipe', 'ignore', 'inherit'] });
    const t0 = Date.now();
    for (let f = 0; f < N; f++) {
      await page.evaluate(t => window.render(t), f / FPS);
      const buf = await page.screenshot({ type: 'jpeg', quality: 94 });
      if (!p.stdin.write(buf)) await new Promise(r => p.stdin.once('drain', r));
      if (f % 90 === 0) console.log(`frame ${f}/${N} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
    p.stdin.end();
    await new Promise(r => p.on('close', r));
  }
  await browser.close();
})();
