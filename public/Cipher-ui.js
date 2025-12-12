// Cipher UI + logic (vanilla JS). No external libraries.

export function mountCipher(root, env) {
  const PRESETS = [
    "coffee then build",
    "ship tiny things",
    "one clean thought",
    "less noise, more signal",
    "today: focus block",
    "reply later (actually)",
    "make it weird",
    "small win unlocked",
    "write the first line",
    "debug the vibe",
    "touch grass soon",
    "post once, done",
    "keep it simple",
    "no scope creep",
    "breathe, then type",
    "read, then decide",
    "one call only",
    "protect your attention",
    "reduce the scroll",
    "learn one trick",
    "choose the hard yes",
    "ship > perfect",
    "sleep before hype",
    "be kind, be fast",
    "save your energy",
    "quiet confidence",
    "do it in 10",
    "clear inbox, clear mind",
    "trust the process",
    "make a better default"
  ];

  const SHAPES = ["□","△","○","◇","▦","▣","▢","▧","◍","⬡"];
  const COLORS = ["#22c55e","#60a5fa","#a78bfa","#f472b6","#fbbf24","#34d399","#fb7185","#c084fc","#38bdf8","#4ade80"];

  const state = {
    env,
    text: "",
    glyphs: [],
    glyphText: "",
    copied: false
  };

  function hashBytes(s) {
    // simple SHA-256 using Web Crypto if available; fallback to JS hash
    if (window.crypto?.subtle) {
      return window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)).then(buf => new Uint8Array(buf));
    }
    let h = 2166136261 >>> 0;
    for (let i=0;i<s.length;i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    const out = new Uint8Array(32);
    for (let i=0;i<32;i++) { h ^= (h << 13); h ^= (h >>> 17); h ^= (h << 5); out[i] = h & 255; }
    return Promise.resolve(out);
  }

  async function encode(text) {
    const clean = (text || "").trim().toLowerCase();
    if (!clean) return { glyphs: [], glyphText: "" };

    const bytes = await hashBytes("cipher:v1:" + clean);
    const count = 10; // compact strip
    const glyphs = [];
    const glyphChars = [];

    for (let i=0;i<count;i++) {
      const b = bytes[i];
      const shape = SHAPES[b % SHAPES.length];
      const color = COLORS[bytes[(i+11)%32] % COLORS.length];
      const w = 18 + (bytes[(i+5)%32] % 18); // 18..35
      glyphs.push({ shape, color, w });
      glyphChars.push(shape);
    }

    // Include a tiny checksum tail for uniqueness
    const tail = bytes[31].toString(16).padStart(2,"0").toUpperCase();
    const glyphText = glyphChars.join("") + "·" + tail;
    return { glyphs, glyphText };
  }

  function haptic() {
    if (navigator.vibrate) navigator.vibrate(12);
  }

  function drawCanvas(glyphs) {
    const cv = root.querySelector("#cv");
    if (!cv) return;
    const ctx = cv.getContext("2d");

    const cssW = Math.min(520, root.querySelector(".card").clientWidth - 20);
    const cssH = 84;
    cv.style.width = cssW + "px";
    cv.style.height = cssH + "px";
    cv.width = Math.floor(cssW * devicePixelRatio);
    cv.height = Math.floor(cssH * devicePixelRatio);
    ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);

    // background
    ctx.clearRect(0,0,cssW,cssH);
    const g = ctx.createLinearGradient(0,0,cssW,cssH);
    g.addColorStop(0,"rgba(255,255,255,.06)");
    g.addColorStop(1,"rgba(0,0,0,.14)");
    ctx.fillStyle = g;
    roundRect(ctx, 0, 0, cssW, cssH, 18);
    ctx.fill();

    // baseline
    ctx.strokeStyle = "rgba(148,163,184,.22)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(18, cssH/2);
    ctx.lineTo(cssW-18, cssH/2);
    ctx.stroke();

    // glyphs
    let x = 22;
    const y = cssH/2;
    ctx.font = "28px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
    ctx.textBaseline = "middle";

    glyphs.forEach((g, i) => {
      ctx.fillStyle = g.color;
      ctx.fillText(g.shape, x, y);
      // tiny ticks
      ctx.fillStyle = "rgba(226,232,240,.35)";
      ctx.fillRect(x+10, y+18, 1.5, 10);
      x += g.w;
    });

    // label
    ctx.fillStyle = "rgba(148,163,184,.85)";
    ctx.font = "12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("Cipher strip", 16, 18);
  }

  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w/2, h/2);
    ctx.beginPath();
    ctx.moveTo(x+rr, y);
    ctx.arcTo(x+w, y, x+w, y+h, rr);
    ctx.arcTo(x+w, y+h, x, y+h, rr);
    ctx.arcTo(x, y+h, x, y, rr);
    ctx.arcTo(x, y, x+w, y, rr);
    ctx.closePath();
  }

  async function setText(next) {
    state.text = next;
    state.copied = false;
    const { glyphs, glyphText } = await encode(next);
    state.glyphs = glyphs;
    state.glyphText = glyphText;
    render(false);
    drawCanvas(glyphs);
    try { localStorage.setItem("cipher:last", state.text); } catch {}
  }

  async function copyGlyphText() {
    if (!state.glyphText) return;
    try {
      await navigator.clipboard.writeText(state.glyphText);
      state.copied = true;
      render(false);
      haptic();
    } catch {
      // fallback: select text
      const el = root.querySelector("#glyphText");
      if (el) {
        const r = document.createRange();
        r.selectNodeContents(el);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(r);
      }
    }
  }

  function render(focus=true) {
    root.innerHTML = `
      <div class="wrap">
        <header class="top">
          <div class="brand">
            <div class="logo">CIPHER</div>
            <div class="sub">${env.isMini ? "Mini App" : "Web"} • deterministic glyphs</div>
          </div>
          <button class="btn ghost" id="rand" title="Random preset">Random</button>
        </header>

        <main class="card">
          <div class="hint">
            Type a short phrase. Cipher turns it into a compact strip you can paste anywhere.
          </div>

          <div class="field">
            <input id="inp" maxlength="44" placeholder="Type… (e.g. ship tiny things)" value="${escapeHtml(state.text)}" />
            <button class="btn" id="go">Encode</button>
          </div>

          <canvas id="cv" width="520" height="84" aria-label="Cipher strip"></canvas>

          <div class="out">
            <div class="label">Text glyphs</div>
            <div class="glyphText" id="glyphText">${escapeHtml(state.glyphText || "—")}</div>
            <div class="row">
              <button class="btn" id="copy">${state.copied ? "Copied" : "Copy"}</button>
              <button class="btn ghost" id="clear">Clear</button>
            </div>
          </div>

          <div class="presetTitle">Presets</div>
          <div class="presets">
            ${PRESETS.map(p => `<button class="pill" data-p="${escapeHtml(p)}">${escapeHtml(p)}</button>`).join("")}
          </div>
        </main>

        <footer class="foot">
          <div class="envpill">${env.isMini ? "Farcaster/Base" : "Web preview"}</div>
          <div class="tiny">Same input → same strip.</div>
        </footer>
      </div>
    `;

    const inp = root.querySelector("#inp");
    const go = root.querySelector("#go");

    go.addEventListener("click", async () => { await setText(inp.value); haptic(); });

    inp.addEventListener("keydown", async (e) => {
      if (e.key === "Enter") { e.preventDefault(); await setText(inp.value); haptic(); }
    });

    root.querySelector("#rand").addEventListener("click", async () => {
      const p = PRESETS[Math.floor(Math.random()*PRESETS.length)];
      inp.value = p;
      await setText(p);
      haptic();
    });

    root.querySelector("#copy").addEventListener("click", copyGlyphText);

    root.querySelector("#clear").addEventListener("click", async () => {
      inp.value = "";
      await setText("");
      drawCanvas([]);
    });

    root.querySelectorAll(".pill").forEach(btn => {
      btn.addEventListener("click", async () => {
        const p = btn.getAttribute("data-p") || "";
        inp.value = p;
        await setText(p);
        haptic();
      });
    });

    if (focus) inp.focus();
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[c]));
  }

  // init
  const last = (() => { try { return localStorage.getItem("cipher:last") || ""; } catch { return ""; }})();
  render(true);
  setText(last || PRESETS[0]);
}
