/* Barcode Syrup — анимации, скролл, сборка секций */
const { gsap, ScrollTrigger, Lenis, BS } = window;
gsap.registerPlugin(ScrollTrigger);

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isMobile = () => window.innerWidth < 761;
const SVGNS = "http://www.w3.org/2000/svg";

document.body.classList.add("is-loading");
document.body.style.setProperty("--bg", "#120b1c");
document.body.style.setProperty("--fg", "#f6efe4");
document.body.style.setProperty("--hc", "#ffffff");

/* ---------- Утилиты ---------- */
function splitText(el) {
  if (el.dataset.splitDone) return $$(".c", el);
  const text = el.textContent.trim();
  el.setAttribute("aria-label", text);
  el.textContent = "";
  text.split(/\s+/).forEach((word, wi, arr) => {
    const w = document.createElement("span");
    w.className = "w";
    w.setAttribute("aria-hidden", "true");
    for (const ch of word) {
      const c = document.createElement("span");
      c.className = "c";
      c.textContent = ch;
      w.appendChild(c);
    }
    el.appendChild(w);
    if (wi < arr.length - 1) el.appendChild(document.createTextNode(" "));
  });
  el.dataset.splitDone = "1";
  return $$(".c", el);
}

function bars(seed, n) {
  let s = 0;
  for (const ch of String(seed)) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  const out = [];
  for (let i = 0; i < n; i++) { s = (s * 1664525 + 1013904223) >>> 0; out.push(1 + (s >>> 28) % 4); }
  return out;
}

function fillBarcode(svg, seed, n, w, h, gapK = 1.7) {
  const b = bars(seed, n);
  const total = b.reduce((a, x) => a + x * gapK, 0);
  const unit = w / total;
  let x = 0;
  const rects = [];
  b.forEach((bw) => {
    const r = document.createElementNS(SVGNS, "rect");
    r.setAttribute("x", x.toFixed(2));
    r.setAttribute("y", 0);
    r.setAttribute("width", (bw * unit).toFixed(2));
    r.setAttribute("height", h);
    svg.appendChild(r);
    rects.push(r);
    x += bw * unit * gapK;
  });
  return rects;
}

function miniCode(seed) {
  const b = bars(seed, 14);
  let x = 0, out = "";
  b.forEach((w) => { out += `<rect x="${x}" y="0" width="${w * 0.9}" height="14"/>`; x += w * 1.6; });
  return `<svg class="card__code" viewBox="0 0 ${x} 14" preserveAspectRatio="none" fill="currentColor" aria-hidden="true">${out}</svg>`;
}

/* WhatsApp-ссылки */
function wireWa(root = document) {
  $$(".js-wa", root).forEach((a) => { a.href = BS.wa(a.dataset.wa || "Здравствуйте!"); });
}

/* ---------- Сборка разметки ---------- */
const loaderRects = fillBarcode($("#loaderBars"), "barcode-syrup", 30, 300, 120);
const footerRects = fillBarcode($("#footerCode"), "996507508636", 58, 600, 120);

// бегущая строка
(function buildMarquee() {
  const track = $("#marquee");
  const items = BS.FLAVORS.slice(0, 16).map((f) => `<span>${f.ru}<b style="--c:${f.c}"></b></span>`).join("");
  track.innerHTML = items + items;
})();

// панели вкусов в истории
const panels = BS.STORY.map((f, i) => {
  const el = document.createElement("div");
  el.className = "fpanel";
  el.innerHTML = `
    <div class="fpanel__num"><span>${f.num}</span><i></i><span>05</span></div>
    <h2 class="fpanel__name">${f.ru}</h2>
    <div class="fpanel__label">${f.en}</div>
    <p class="fpanel__text">${f.text}</p>
    <div class="fpanel__fits">${f.fits.map((x) => `<span>${x}</span>`).join("")}</div>
    <a class="btn btn--light js-wa" data-wa="Здравствуйте! Хочу заказать сироп Barcode Syrup «${f.en}»." href="#" target="_blank" rel="noopener">Заказать ${f.en}</a>`;
  $("#panels").appendChild(el);
  const chars = splitText($(".fpanel__name", el));
  const rest = [$(".fpanel__num", el), $(".fpanel__label", el), $(".fpanel__text", el), $(".fpanel__fits", el), $(".btn", el)];
  gsap.set(el, { autoAlpha: 0 });
  return { el, chars, rest };
});

const progressEl = $("#progress");
BS.STORY.forEach((f) => {
  const d = document.createElement("div");
  d.innerHTML = `<span>${f.ru}</span><i></i>`;
  progressEl.appendChild(d);
});
const progressItems = $$("div", progressEl);

// фильтры и сетка вкусов
const grid = $("#grid");
const filters = $("#filters");
let currentCat = "all";

BS.CATS.forEach((c) => {
  const n = c.id === "all" ? BS.FLAVORS.length : BS.FLAVORS.filter((f) => f.cat === c.id).length;
  const b = document.createElement("button");
  b.type = "button";
  b.className = "filter";
  b.setAttribute("aria-pressed", c.id === "all");
  b.innerHTML = `${c.ru}<small>${n}</small>`;
  b.addEventListener("click", () => {
    if (currentCat === c.id) return;
    currentCat = c.id;
    $$(".filter", filters).forEach((x) => x.setAttribute("aria-pressed", x === b));
    renderGrid(true);
  });
  filters.appendChild(b);
});

function cardHTML(f) {
  const pad = String(f.n).padStart(2, "0");
  return `
    <div class="card__top"><span>${pad} / 33</span>${miniCode(f.en)}</div>
    <svg class="card__bottle" viewBox="0 0 80 170" aria-hidden="true">
      <rect x="31" y="1" width="18" height="16" rx="2.5" fill="#0d0d0d"/>
      <rect x="31" y="13" width="18" height="2" fill="${f.c}"/>
      <path d="M34 17h12v25c0 8 24 14 24 32v84a8 8 0 0 1-8 8H18a8 8 0 0 1-8-8V74c0-18 24-24 24-32z" fill="rgba(255,255,255,.07)" stroke="rgba(255,255,255,.35)" stroke-width="1.4"/>
      <path d="M13 84h54v76a5 5 0 0 1-5 5H18a5 5 0 0 1-5-5z" fill="${f.c}"/>
      <path d="M13 84h54v76a5 5 0 0 1-5 5H18a5 5 0 0 1-5-5z" fill="url(#liqShade)"/>
      <rect x="13" y="104" width="54" height="36" fill="#f5eee2"/>
      <rect x="13" y="134" width="54" height="6" fill="${f.c}"/>
      <text x="40" y="115" text-anchor="middle" font-family="Unbounded, sans-serif" font-weight="900" font-size="6.4" fill="#14100c">BARCODE</text>
      <g fill="#14100c">${bars(f.en, 12).map((w, i) => `<rect x="${26 + i * 2.4}" y="119" width="${w * 0.45}" height="10"/>`).join("")}</g>
      <rect x="16" y="78" width="4.5" height="82" rx="2.2" fill="#fff" opacity=".28"/>
      <path d="M34 17h12v25c0 8 24 14 24 32v84a8 8 0 0 1-8 8H18a8 8 0 0 1-8-8V74c0-18 24-24 24-32z" fill="url(#glassShine)"/>
    </svg>
    <div>
      <div class="card__en">${f.en}</div>
      <div class="card__ru">${f.ru}</div>
      <div class="card__fits">${f.fits.map((x) => `<span>${x}</span>`).join("")}</div>
      <a class="card__order js-wa" data-wa="Здравствуйте! Хочу заказать сироп Barcode Syrup «${f.en}» (${f.ru})." href="#" target="_blank" rel="noopener">Заказать</a>
    </div>`;
}

function renderGrid(animate) {
  const list = BS.FLAVORS.filter((f) => currentCat === "all" || f.cat === currentCat);
  const build = () => {
    grid.innerHTML = "";
    list.forEach((f) => {
      const card = document.createElement("article");
      card.className = "card";
      card.tabIndex = 0;
      card.style.setProperty("--c", f.c);
      card.innerHTML = cardHTML(f);
      grid.appendChild(card);
      bindCard(card);
    });
    wireWa(grid);
    if (animate && !reduced) {
      gsap.fromTo($$(".card", grid), { y: 50, opacity: 0, rotateX: -12 }, { y: 0, opacity: 1, rotateX: 0, duration: 0.7, stagger: 0.025, ease: "power3.out", clearProps: "transform,opacity" });
    }
    ScrollTrigger.refresh();
  };
  if (animate && !reduced && grid.children.length) {
    gsap.to($$(".card", grid), { y: -20, opacity: 0, duration: 0.25, stagger: 0.008, ease: "power2.in", onComplete: build });
  } else build();
}

function bindCard(card) {
  const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (fine) {
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      card.style.setProperty("--mx", x * 100 + "%");
      card.style.setProperty("--my", y * 100 + "%");
      card.style.setProperty("--ry", (x - 0.5) * 14 + "deg");
      card.style.setProperty("--rx", (0.5 - y) * 12 + "deg");
    });
    card.addEventListener("pointerleave", () => {
      card.style.setProperty("--ry", "0deg");
      card.style.setProperty("--rx", "0deg");
    });
  } else {
    card.addEventListener("click", (e) => {
      if (e.target.closest("a")) return;
      const open = card.classList.contains("is-open");
      $$(".card.is-open", grid).forEach((c) => c.classList.remove("is-open"));
      if (!open) card.classList.add("is-open");
    });
  }
}

// общие градиенты для мини-бутылок
document.body.insertAdjacentHTML("beforeend", `
  <svg width="0" height="0" style="position:absolute" aria-hidden="true">
    <defs>
      <linearGradient id="liqShade" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".25"/><stop offset=".35" stop-color="#fff" stop-opacity=".12"/><stop offset=".7" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></linearGradient>
      <linearGradient id="glassShine" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity=".25"/><stop offset=".18" stop-color="#fff" stop-opacity="0"/><stop offset=".85" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".2"/></linearGradient>
    </defs>
  </svg>`);

renderGrid(false);

// рецепты
(function buildRecipes() {
  const box = $("#recipesGrid");
  BS.RECIPES.forEach((r, i) => {
    const ice = r.ice ? `
      <g fill="#fff" opacity=".55">
        <rect x="42" y="72" width="26" height="24" rx="5" transform="rotate(-14 55 84)"/>
        <rect x="70" y="80" width="24" height="22" rx="5" transform="rotate(18 82 91)"/>
        <rect x="56" y="104" width="22" height="20" rx="5" transform="rotate(6 67 114)"/>
      </g>` : "";
    const art = document.createElement("article");
    art.className = "recipe reveal";
    art.innerHTML = `
      <svg class="recipe__glass" viewBox="0 0 140 220" aria-hidden="true">
        <defs><clipPath id="rc${i}"><path d="M22 22h96l-11 178a10 10 0 0 1-10 9H43a10 10 0 0 1-10-9z"/></clipPath></defs>
        ${r.ice ? `<rect x="88" y="0" width="7" height="130" rx="3.5" fill="${r.syrup}" transform="rotate(14 92 60)"/>` : ""}
        <g clip-path="url(#rc${i})">
          <g class="pour">
            <rect x="0" y="54" width="140" height="170" fill="${r.drink}"/>
            <path d="M0 160 Q35 150 70 160 T140 160 V230 H0z" fill="${r.syrup}"/>
            <rect x="0" y="46" width="140" height="14" fill="${r.top}"/>
            ${ice}
            <g fill="#fff" opacity=".6"><circle cx="50" cy="140" r="2.5"/><circle cx="90" cy="128" r="2"/><circle cx="72" cy="176" r="2.5"/><circle cx="60" cy="110" r="1.6"/></g>
          </g>
        </g>
        <path d="M22 22h96l-11 178a10 10 0 0 1-10 9H43a10 10 0 0 1-10-9z" fill="rgba(255,255,255,.18)" stroke="rgba(42,20,8,.55)" stroke-width="2.4" stroke-linejoin="round"/>
        <path d="M32 34l7 150" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".6"/>
      </svg>
      <h3>${r.name}</h3>
      <p>${r.how}</p>`;
    box.appendChild(art);
  });
})();

wireWa();

/* ---------- Плавный скролл ---------- */
let lenis = null;
if (!reduced) {
  lenis = new Lenis({ lerp: 0.1, smoothWheel: true, wheelMultiplier: 1 });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();
}

document.addEventListener("click", (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const id = a.getAttribute("href");
  const target = id === "#top" ? 0 : $(id);
  if (target === null) return;
  e.preventDefault();
  if (lenis) lenis.scrollTo(target, { duration: 1.6 });
  else if (target === 0) window.scrollTo({ top: 0 });
  else target.scrollIntoView();
});

/* ---------- 3D-сцена ---------- */
let scene3d = null;
const stage = $("#stage");

async function initScene() {
  const fontWait = Promise.all([
    document.fonts.load('900 100px "Unbounded"'),
    document.fonts.load('400 40px "Unbounded"'),
    document.fonts.load('700 20px "Manrope"')
  ]).catch(() => {});
  await Promise.race([fontWait, new Promise((r) => setTimeout(r, 2500))]);
  try {
    const { createScene } = await import("./scene.js");
    scene3d = createScene($("#gl"), { story: BS.STORY });
    scene3d.renderOnce();
    const r = stage.getBoundingClientRect();
    if (r.bottom > 0 && r.top < window.innerHeight) scene3d.start();
    document.fonts.ready.then(() => scene3d && scene3d.redrawText());
  } catch (err) {
    console.warn("WebGL недоступен, включён запасной вариант", err);
    document.documentElement.classList.add("no-webgl");
    scene3d = null;
  }
}

/* ---------- Загрузка ---------- */
function runLoader(ready) {
  return new Promise((resolve) => {
    const count = $("#loaderCount");
    const prog = { v: 0 };
    const set = () => { count.textContent = String(Math.round(prog.v)).padStart(3, "0"); };
    gsap.from(loaderRects, { scaleY: 0, duration: 0.6, ease: "power3.out", stagger: { each: 0.015, from: "random" } });
    const t1 = gsap.to(prog, { v: 82, duration: reduced ? 0.2 : 1.1, ease: "power2.out", onUpdate: set });
    const minTime = new Promise((r) => setTimeout(r, reduced ? 200 : 1200));
    Promise.all([ready, minTime]).then(() => {
      t1.kill();
      gsap.to(prog, {
        v: 100, duration: 0.35, ease: "power1.inOut", onUpdate: set,
        onComplete: () => {
          const tl = gsap.timeline({ onComplete: () => { $("#loader").remove(); } });
          tl.to(loaderRects, { scaleY: 0, duration: 0.45, ease: "power3.in", stagger: { each: 0.01, from: "center" } })
            .to(".loader__digits, .loader__brand, .loader__laser", { opacity: 0, duration: 0.3 }, 0)
            .to("#loader", { clipPath: "inset(0 0 100% 0)", duration: 0.8, ease: "expo.inOut" }, 0.3)
            .add(resolve, 0.55);
        }
      });
    });
  });
}

/* ---------- Первый экран ---------- */
const introEl = $("#intro");
const introChars = splitText($(".intro__title"));
gsap.set(introChars, { yPercent: 115 });
gsap.set([".eyebrow", ".intro__lede", ".intro__actions", "#scrollHint > *", "#progress"], { opacity: 0, y: 24 });

function playIntro() {
  document.body.classList.remove("is-loading");
  if (lenis) lenis.start();
  const tl = gsap.timeline();
  tl.to(introChars, { yPercent: 0, duration: 1.1, ease: "expo.out", stagger: 0.025 })
    .to([".eyebrow", ".intro__lede", ".intro__actions"], { opacity: 1, y: 0, duration: 0.9, ease: "power3.out", stagger: 0.08 }, 0.3)
    .to(["#scrollHint > *", "#progress"], { opacity: 1, y: 0, duration: 0.8, ease: "power3.out" }, 0.7);
  if (scene3d) scene3d.appear();
  $(".sticky-wa").classList.add("is-on");
}

/* ---------- История: скролл управляет бутылкой ---------- */
let activePanel = -1;
function showPanel(idx) {
  if (idx === activePanel) return;
  const prev = panels[activePanel];
  const next = panels[idx];
  const dir = idx > activePanel ? 1 : -1;
  activePanel = idx;
  if (prev) {
    gsap.killTweensOf([prev.el, prev.chars, prev.rest]);
    gsap.to(prev.chars, { yPercent: -110 * dir, duration: 0.4, ease: "power3.in", stagger: 0.015 });
    gsap.to(prev.rest, { opacity: 0, y: -16 * dir, duration: 0.3, ease: "power2.in" });
    gsap.to(prev.el, { autoAlpha: 0, duration: 0.01, delay: 0.45 });
  }
  if (next) {
    gsap.killTweensOf([next.el, next.chars, next.rest]);
    gsap.set(next.el, { autoAlpha: 1 });
    gsap.fromTo(next.chars, { yPercent: 115 * dir }, { yPercent: 0, duration: 0.9, ease: "expo.out", stagger: 0.03, delay: prev ? 0.2 : 0 });
    gsap.fromTo(next.rest, { opacity: 0, y: 22 * dir }, { opacity: 1, y: 0, duration: 0.7, ease: "power3.out", stagger: 0.06, delay: prev ? 0.3 : 0.1 });
  }
  progressItems.forEach((d, i) => d.classList.toggle("is-active", i === idx || (idx < 0 && i === 0)));
}

function setFallbackColors(f) {
  const i = Math.min(Math.floor(f), BS.STORY.length - 2);
  const k = f - i;
  const mix = (a, b) => gsap.utils.interpolate(a, b, k);
  stage.style.setProperty("--liquid", mix(BS.STORY[i].liquid, BS.STORY[i + 1].liquid));
  stage.style.setProperty("--bgIn", mix(BS.STORY[i].bgIn, BS.STORY[i + 1].bgIn));
  stage.style.setProperty("--bgOut", mix(BS.STORY[i].bgOut, BS.STORY[i + 1].bgOut));
}

function initStory() {
  const hint = $("#scrollHint");
  ScrollTrigger.create({
    trigger: "#story",
    start: "top top",
    end: "bottom bottom",
    onUpdate(self) {
      const p = self.progress;
      const f = clamp((p - 0.12) / 0.8, 0, 1) * (BS.STORY.length - 1);
      if (scene3d) { scene3d.setProgress(p, f); scene3d.setVelocity(self.getVelocity() / 10); }
      else setFallbackColors(f);
      const io = 1 - smooth(0.015, 0.075, p);
      introEl.style.opacity = io;
      introEl.style.setProperty("--iy", (-(1 - io) * 60) + "px");
      introEl.style.pointerEvents = io < 0.2 ? "none" : "";
      hint.style.opacity = io;
      showPanel(p < 0.08 ? -1 : Math.round(f));
    }
  });
  progressItems[0].classList.add("is-active");

  // рендерим только когда сцена на экране
  new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (!scene3d) return; e.isIntersecting ? scene3d.start() : scene3d.stop(); });
  }, { threshold: 0 }).observe(stage);

  window.addEventListener("pointermove", (e) => {
    const x = (e.clientX / window.innerWidth) * 2 - 1;
    const y = -((e.clientY / window.innerHeight) * 2 - 1);
    if (scene3d) scene3d.setPointer(x, y);
  }, { passive: true });

  let rt;
  window.addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(() => { if (scene3d) scene3d.resize(); }, 150);
  });
}

/* ---------- Анимации секций ---------- */
function initSections() {
  // цвет фона между секциями
  const meta = $('meta[name="theme-color"]');
  $$("[data-bg]").forEach((sec) => {
    ScrollTrigger.create({
      trigger: sec,
      start: "top 55%",
      end: "bottom 55%",
      onToggle(self) {
        if (!self.isActive) return;
        gsap.to(document.body, { "--bg": sec.dataset.bg, "--fg": sec.dataset.fg, "--hc": sec.dataset.fg, duration: reduced ? 0 : 1, ease: "power2.inOut" });
        meta.setAttribute("content", sec.dataset.bg);
      }
    });
  });
  ScrollTrigger.create({
    trigger: "#story", start: "top top", end: "bottom 55%",
    onEnterBack: () => { meta.setAttribute("content", "#1a0c03"); gsap.to(document.body, { "--hc": "#ffffff", duration: 0.6 }); }
  });

  // заголовки по буквам
  $$("[data-split]").forEach((el) => {
    if (el.classList.contains("intro__title")) return;
    const chars = splitText(el);
    if (reduced) return;
    gsap.from(chars, {
      yPercent: 115, rotate: 6, duration: 1.1, ease: "expo.out", stagger: 0.022,
      scrollTrigger: { trigger: el, start: "top 85%" }
    });
  });

  // появление блоков
  if (!reduced) {
    $$(".reveal").forEach((el) => {
      gsap.from(el, { y: 50, opacity: 0, duration: 1, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 90%" } });
    });
  }

  // счётчики
  $$("[data-count]").forEach((el) => {
    const to = +el.dataset.count;
    const o = { v: 0 };
    ScrollTrigger.create({
      trigger: el, start: "top 90%", once: true,
      onEnter: () => gsap.to(o, { v: to, duration: reduced ? 0 : 1.6, ease: "power3.out", onUpdate: () => { el.textContent = Math.round(o.v); } })
    });
  });

  // бегущая строка, ускоряется от скорости скролла
  const track = $("#marquee");
  let x = 0, boost = 0;
  ScrollTrigger.create({
    trigger: ".marquee", start: "top bottom", end: "bottom top",
    onUpdate: (self) => { boost = clamp(Math.abs(self.getVelocity()) / 300, 0, 12); }
  });
  gsap.ticker.add((t, dt) => {
    const half = track.scrollWidth / 2;
    if (!half) return;
    x -= (reduced ? 0.3 : 1 + boost) * dt * 0.06;
    boost *= 0.94;
    if (-x >= half) x += half;
    track.style.transform = `translate3d(${x}px,0,0)`;
  });

  // наливаем сироп в стаканы
  $$(".recipe").forEach((r) => {
    const pour = $(".pour", r);
    if (reduced) return;
    gsap.fromTo(pour, { y: 170 }, { y: 0, duration: 1.8, ease: "power2.out", scrollTrigger: { trigger: r, start: "top 80%" } });
  });

  // штрихкод в подвале
  if (!reduced) {
    gsap.from(footerRects, {
      scaleY: 0, duration: 1, ease: "expo.out", stagger: { each: 0.012, from: "random" },
      scrollTrigger: { trigger: ".footer", start: "top 90%" }
    });
  }

  // карточки «Почему мы»: лёгкий параллакс
  if (!reduced && !isMobile()) {
    $$(".why-card").forEach((c, i) => {
      gsap.to(c, { yPercent: -10 * (i % 2 ? 1 : -0.4), ease: "none", scrollTrigger: { trigger: ".why__grid", scrub: true } });
    });
  }
}

/* ---------- Шапка прячется при скролле вниз ---------- */
function initHeader() {
  const els = [$("#header"), $(".header-cta")];
  let last = 0;
  ScrollTrigger.create({
    start: 0, end: "max",
    onUpdate(self) {
      const y = self.scroll();
      const hide = y > 200 && self.direction === 1 && Math.abs(y - last) > 2;
      if (self.direction === -1 || y < 200) els.forEach((e) => e.classList.remove("is-hidden"));
      else if (hide) els.forEach((e) => e.classList.add("is-hidden"));
      last = y;
    }
  });
}

/* ---------- Курсор ---------- */
function initCursor() {
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  const cur = $("#cursor");
  const xTo = gsap.quickTo(cur, "x", { duration: 0.35, ease: "power3" });
  const yTo = gsap.quickTo(cur, "y", { duration: 0.35, ease: "power3" });
  window.addEventListener("pointermove", (e) => { cur.classList.add("is-on"); xTo(e.clientX); yTo(e.clientY); }, { passive: true });
  document.addEventListener("pointerover", (e) => cur.classList.toggle("is-hover", !!e.target.closest("a, button, .card")));
  document.addEventListener("pointerleave", () => cur.classList.remove("is-on"));
}

/* ---------- Подгонка заголовков, чтобы слова не вылезали ---------- */
function fitHeadings() {
  $$("[data-split], .fpanel__name").forEach((el) => {
    el.style.fontSize = "";
    const words = $$(".w", el);
    if (!words.length) return;
    const avail = el.parentElement.clientWidth || el.clientWidth;
    const widest = Math.max(...words.map((w) => w.getBoundingClientRect().width));
    if (widest > avail) {
      const fs = parseFloat(getComputedStyle(el).fontSize);
      el.style.fontSize = Math.floor(fs * (avail / widest) * 0.97) + "px";
    }
  });
}

/* ---------- Старт ---------- */
const ready = initScene();
initStory();
initSections();
initCursor();
initHeader();
fitHeadings();
document.fonts.ready.then(fitHeadings);
let fitT;
window.addEventListener("resize", () => { clearTimeout(fitT); fitT = setTimeout(() => { fitHeadings(); ScrollTrigger.refresh(); }, 200); });
runLoader(ready).then(() => {
  fitHeadings();
  playIntro();
  ScrollTrigger.refresh();
});
