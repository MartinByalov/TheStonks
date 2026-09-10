/**
 * The Stonks v2 - gradient & smooth procedural generator
 * Zero-dependency ES module.
 */

function hashSeed(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rngFor(tokenId, salt) {
  return mulberry32(hashSeed('stonk-v2-' + tokenId + '-' + salt)());
}

const CANDLE_PALETTES = {
  greencandle1: { base: '#1fd67a', light: '#5cff9e', dark: '#0e8a4a', glow: 'rgba(31,214,122,0.3)' },
  greencandle2: { base: '#16c468', light: '#4ae88e', dark: '#0a7a3e', glow: 'rgba(22,196,104,0.3)' },
  greencandle3: { base: '#28e08c', light: '#6affb0', dark: '#129c58', glow: 'rgba(40,224,140,0.3)' },
  redcandle1:   { base: '#ed1c24', light: '#ff5c63', dark: '#a00e16', glow: 'rgba(237,28,36,0.3)' },
  redcandle2:   { base: '#d81a22', light: '#ff4a52', dark: '#8c0c14', glow: 'rgba(216,26,34,0.3)' },
  redcandle3:   { base: '#f23030', light: '#ff6e6e', dark: '#a81818', glow: 'rgba(242,48,48,0.3)' },
  goldencandle1: { base: '#ffd700', light: '#ffe84d', dark: '#c7a000', glow: 'rgba(255,215,0,0.4)' },
};

const BG_COLORS = {
  gradient: ['#6a11cb', '#2575fc'],
  gradient2: ['#f093fb', '#f5576c'],
  gradient3: ['#0093E9', '#80D0C7'],
  gradient4: ['#0f0c29', '#302b63'],
  gradient5: ['#f12711', '#f5af19'],
  gradient6: ['#8E2DE2', '#4A00E0'],
  gradient7: ['#134E5E', '#71B280'],
  gradient8: ['#f12711', '#ff6b35'],
  gradient9: ['#11998e', '#38ef7d'],
  gradient10: ['#a8e063', '#56ab2f'],
};

export class StonkGeneratorV2 {
  constructor(opts = {}) {
    this.basePath = opts.basePath || '';
    this.config = null;
    this.collection = null;
    this.totalSupply = 10000;
    this._tokenIndex = new Map();
  }

  async load() {
    const [cRes, colRes] = await Promise.all([
      fetch(this.basePath + '/data/traits-config.json'),
      fetch(this.basePath + '/data/stonks-collection.json'),
    ]);
    if (!cRes.ok) throw new Error('Config not found');
    if (!colRes.ok) throw new Error('Collection not found');
    this.config = await cRes.json();
    this.collection = await colRes.json();
    this.totalSupply = this.collection.totalSupply;
    for (const t of this.collection.tokens) this._tokenIndex.set(t.id, t);
  }

  randomId() { return 1 + Math.floor(Math.random() * this.totalSupply); }

  getStonk(id) {
    const r = this._tokenIndex.get(Number(id));
    if (!r) throw new Error('No Stonk ' + id);
    const traits = [];
    for (const cat of this.config.categories) {
      const oid = r.traits[cat.key];
      if (!oid) continue;
      const opt = cat.options.find(o => o.id === oid);
      traits.push({ category: cat.key, categoryLabel: cat.label, option: oid,
        name: opt ? opt.name : 'None', rarityTier: opt && opt.rarityTier ? opt.rarityTier : 'common' });
    }
    return { id: r.id, traits, rarityScore: r.rarityScore, rarityRank: r.rarityRank, totalSupply: this.totalSupply };
  }

  async render(tokenId, canvas, opts = {}) {
    const r = this._tokenIndex.get(Number(tokenId));
    if (!r) throw new Error('No Stonk ' + tokenId);
    const s = opts.size || 480;
    canvas.width = s; canvas.height = s;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, s, s);
    this._drawBg(ctx, s, r.traits.background);
    if (r.traits.chart) this._drawChart(ctx, s, r.id, r.traits.chart);
    this._drawCandle(ctx, s, r);
    this._drawExtras(ctx, s, r);
    return canvas;
  }

  _drawBg(ctx, s, id) {
    const c = BG_COLORS[id] || BG_COLORS.gradient;
    const g = ctx.createLinearGradient(0, 0, s, s);
    g.addColorStop(0, c[0]); g.addColorStop(1, c[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    const rg = ctx.createRadialGradient(s/2, s/2, 0, s/2, s/2, s * 0.5);
    rg.addColorStop(0, 'rgba(255,255,255,0.06)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, s, s);
  }

  _drawChart(ctx, s, tid, style) {
    const rng = rngFor(tid, style);
    const pts = 9 + Math.floor(rng() * 4);
    const mx = s * 0.06, mt = s * 0.12, mb = s * 0.38;
    const uw = s - mx * 2, uh = s - mt - mb;
    const bias = { uptrend: -0.55, downtrend: 0.55, choppy: 0 }[style] || 0;
    let y = mt + uh * (style === 'uptrend' ? 0.85 : style === 'downtrend' ? 0.15 : 0.5);
    const ys = [y];
    for (let i = 1; i < pts; i++) { y = Math.min(mt + uh, Math.max(mt, y + (rng() - 0.5 + bias) * uh * 0.32)); ys.push(y); }
    const dx = uw / (pts - 1), lw = Math.max(2.5, s * 0.018);
    ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = s * 0.01;
    for (let i = 1; i < ys.length; i++) {
      const x0 = mx + dx * (i-1), x1 = mx + dx * i, up = ys[i] < ys[i-1];
      ctx.beginPath(); ctx.moveTo(x0, ys[i-1]); ctx.lineTo(x1, ys[i]);
      ctx.strokeStyle = up ? '#1fd67a' : '#ed1c24'; ctx.lineWidth = lw; ctx.stroke();
      ctx.beginPath(); ctx.arc(x1, ys[i], lw * 0.7, 0, Math.PI * 2);
      ctx.fillStyle = up ? '#1fd67a' : '#ed1c24'; ctx.fill();
    }
    ctx.restore();
  }
  _drawCandle(ctx, s, r) {
    const bid = r.traits.body; if (!bid) return;
    const pal = CANDLE_PALETTES[bid] || CANDLE_PALETTES.greencandle1;
    const cx = s / 2, cw = s * 0.2, ch = s * 0.42, ty = s * 0.38;
    const wh = s * 0.07, ww = s * 0.022;
    ctx.save();
    ctx.shadowColor = pal.glow; ctx.shadowBlur = s * 0.05;
    const wg = ctx.createLinearGradient(cx, ty - wh, cx, ty);
    wg.addColorStop(0, '#ffaa00'); wg.addColorStop(0.3, '#ff6600'); wg.addColorStop(1, '#333');
    ctx.fillStyle = wg;
    ctx.beginPath(); ctx.roundRect(cx - ww/2, ty - wh, ww, wh, [ww/2, ww/2, 0, 0]); ctx.fill();
    const fg = ctx.createRadialGradient(cx, ty - wh, 0, cx, ty - wh, ww * 1.8);
    fg.addColorStop(0, 'rgba(255,255,220,0.95)'); fg.addColorStop(0.3, 'rgba(255,200,50,0.7)'); fg.addColorStop(1, 'rgba(255,100,0,0)');
    ctx.fillStyle = fg;
    ctx.beginPath(); ctx.ellipse(cx, ty - wh - ww * 0.4, ww * 0.7, ww * 1.1, 0, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    const bt = ty, bb = ty + ch, bl = cx - cw / 2, br = cx + cw / 2;
    const bg = ctx.createLinearGradient(bl, 0, br, 0);
    bg.addColorStop(0, pal.dark); bg.addColorStop(0.25, pal.base); bg.addColorStop(0.5, pal.light); bg.addColorStop(0.75, pal.base); bg.addColorStop(1, pal.dark);
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.roundRect(bl, bt, cw, ch, [cw*0.12, cw*0.12, cw*0.06, cw*0.06]); ctx.fill();
    const gg = ctx.createLinearGradient(bl, bt, bl + cw * 0.35, bt + ch);
    gg.addColorStop(0, 'rgba(255,255,255,0.4)'); gg.addColorStop(0.25, 'rgba(255,255,255,0.15)'); gg.addColorStop(0.55, 'rgba(255,255,255,0)');
    ctx.fillStyle = gg;
    ctx.beginPath(); ctx.roundRect(bl, bt, cw * 0.35, ch, [cw*0.12, 0, 0, cw*0.06]); ctx.fill();
    const sh = s * 0.1, sw = s * 0.026;
    const sg = ctx.createLinearGradient(cx, bb, cx, bb + sh);
    sg.addColorStop(0, pal.dark); sg.addColorStop(1, '#222');
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.roundRect(cx - sw/2, bb, sw, sh, [0, 0, sw/2, sw/2]); ctx.fill();
    this._drawFace(ctx, cx, bt + ch * 0.2, cw);
    ctx.restore();
  }

  _drawFace(ctx, cx, y, cw) {
    const es = cw * 0.28, ew = cw * 0.13, eh = cw * 0.16;
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(cx - es, y, ew, eh, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + es, y, ew, eh, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111'; const ps = ew * 0.5;
    ctx.beginPath(); ctx.arc(cx - es, y + eh * 0.1, ps, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + es, y + eh * 0.1, ps, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.arc(cx - es - ps * 0.3, y - eh * 0.2, ps * 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + es - ps * 0.3, y - eh * 0.2, ps * 0.3, 0, Math.PI * 2); ctx.fill();
    const mw = cw * 0.18, mh = cw * 0.07;
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath(); ctx.ellipse(cx, y + eh * 0.55, mw, mh, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(cx, y + eh * 0.55 - mh * 0.15, mw * 0.55, mh * 0.35, 0, 0, Math.PI); ctx.fill();
    ctx.restore();
  }
  _drawExtras(ctx, s, r) {
    const cx = s / 2, cw = s * 0.2, ch = s * 0.42, ty = s * 0.38, bt = ty;
    if (r.traits.dress) this._drDress(ctx, cx, bt + ch * 0.52, cw, r.traits.dress);
    if (r.traits.bodyfeature) this._drBodyF(ctx, cx, bt + ch * 0.38, cw, r.traits.bodyfeature);
    if (r.traits.facefeature) this._drFaceF(ctx, cx, bt + ch * 0.36, cw, r.traits.facefeature);
    if (r.traits.hat) this._drHat(ctx, cx, ty, cw, r.traits.hat);
    if (r.traits.bag) this._drBag(ctx, cx, bt + ch * 0.48, cw, r.traits.bag);
  }

  _drDress(ctx, cx, y, cw, id) {
    ctx.save(); const dw = cw * 1.05, dh = cw * 0.32;
    const cols = { dress1: '#1a1a1a', dress2: '#cc2222', dress3: '#2255cc', dress4: '#daa520', dress5: '#8B0000' };
    ctx.fillStyle = cols[id] || '#444';
    ctx.beginPath(); ctx.moveTo(cx, y - dh * 0.3); ctx.lineTo(cx - dw * 0.38, y + dh * 0.5); ctx.lineTo(cx + dw * 0.38, y + dh * 0.5); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  _drBodyF(ctx, cx, y, cw, id) {
    ctx.save();
    if (id === 'cigar1') {
      ctx.fillStyle = '#8B4513'; ctx.fillRect(cx + cw * 0.28, y - cw * 0.035, cw * 0.45, cw * 0.07);
      ctx.fillStyle = '#ff6600'; ctx.beginPath(); ctx.arc(cx + cw * 0.73, y, cw * 0.04, 0, Math.PI * 2); ctx.fill();
    } else if (id === 'chain1') {
      ctx.strokeStyle = '#daa520'; ctx.lineWidth = cw * 0.035;
      ctx.beginPath(); ctx.arc(cx, y + cw * 0.08, cw * 0.22, 0.2, Math.PI - 0.2); ctx.stroke();
    }
    ctx.restore();
  }

  _drFaceF(ctx, cx, y, cw, id) {
    ctx.save();
    if (id === 'facefeature1') {
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath(); ctx.ellipse(cx - cw * 0.14, y, cw * 0.055, cw * 0.035, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx + cw * 0.14, y, cw * 0.055, cw * 0.035, 0, 0, Math.PI * 2); ctx.fill();
    } else if (id === 'facefeature2') {
      ctx.fillStyle = '#2a2a2a'; ctx.beginPath(); ctx.ellipse(cx, y + cw * 0.13, cw * 0.18, cw * 0.1, 0, 0, Math.PI); ctx.fill();
    } else if (id === 'facefeature3') {
      ctx.fillStyle = '#8B0000';
      ctx.beginPath(); ctx.moveTo(cx, y - cw * 0.08); ctx.lineTo(cx - cw * 0.28, y + cw * 0.25); ctx.lineTo(cx + cw * 0.28, y + cw * 0.25); ctx.closePath(); ctx.fill();
    } else if (id === 'facefeature5') {
      ctx.strokeStyle = '#333'; ctx.lineWidth = cw * 0.025;
      ctx.beginPath(); ctx.ellipse(cx - cw * 0.22, y - cw * 0.08, cw * 0.1, cw * 0.07, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(cx + cw * 0.22, y - cw * 0.08, cw * 0.1, cw * 0.07, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - cw * 0.12, y - cw * 0.08); ctx.lineTo(cx + cw * 0.12, y - cw * 0.08); ctx.stroke();
    } else {
      ctx.fillStyle = '#2a2a2a'; ctx.beginPath(); ctx.ellipse(cx, y + cw * 0.13, cw * 0.18, cw * 0.1, 0, 0, Math.PI); ctx.fill();
    }
    ctx.restore();
  }
  _drHat(ctx, cx, ty, cw, id) {
    ctx.save(); const hw = cw * 1.15, hh = cw * 0.45;
    if (id === 'hat1') {
      ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.ellipse(cx, ty - hh * 0.1, hw * 0.5, hh * 0.12, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(cx - hw * 0.32, ty - hh * 0.75, hw * 0.64, hh * 0.65);
      ctx.beginPath(); ctx.ellipse(cx, ty - hh * 0.75, hw * 0.32, hh * 0.1, 0, 0, Math.PI * 2); ctx.fill();
    } else if (id === 'hat2') {
      ctx.fillStyle = '#111'; ctx.fillRect(cx - hw * 0.38, ty - hh * 0.28, hw * 0.76, hh * 0.28);
      ctx.beginPath(); ctx.moveTo(cx, ty - hh); ctx.lineTo(cx - hw * 0.22, ty - hh * 0.28); ctx.lineTo(cx + hw * 0.22, ty - hh * 0.28); ctx.closePath(); ctx.fill();
    } else if (id === 'hat3') {
      ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.ellipse(cx, ty - hh * 0.08, hw * 0.5, hh * 0.1, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(cx - hw * 0.32, ty - hh * 0.82, hw * 0.64, hh * 0.74);
      ctx.beginPath(); ctx.ellipse(cx, ty - hh * 0.82, hw * 0.32, hh * 0.08, 0, 0, Math.PI * 2); ctx.fill();
    } else if (id === 'hat4') {
      ctx.fillStyle = '#2a2a2a'; ctx.fillRect(cx - hw * 0.32, ty - hh * 0.78, hw * 0.64, hh * 0.7);
      ctx.fillStyle = '#2244aa'; ctx.fillRect(cx - hw * 0.32, ty - hh * 0.32, hw * 0.64, hh * 0.1);
    } else if (id === 'hat5') {
      ctx.fillStyle = '#2a2a2a'; ctx.fillRect(cx - hw * 0.32, ty - hh * 0.78, hw * 0.64, hh * 0.7);
      ctx.fillStyle = '#daa520'; ctx.fillRect(cx - hw * 0.32, ty - hh * 0.32, hw * 0.64, hh * 0.1);
    } else if (id === 'hat6') {
      ctx.fillStyle = '#ffd700'; ctx.beginPath();
      ctx.moveTo(cx - hw * 0.38, ty); ctx.lineTo(cx - hw * 0.38, ty - hh * 0.55); ctx.lineTo(cx - hw * 0.18, ty - hh * 0.28);
      ctx.lineTo(cx, ty - hh * 0.9); ctx.lineTo(cx + hw * 0.18, ty - hh * 0.28); ctx.lineTo(cx + hw * 0.38, ty - hh * 0.55);
      ctx.lineTo(cx + hw * 0.38, ty); ctx.closePath(); ctx.fill();
    } else if (id === 'hat7') {
      ctx.fillStyle = '#daa520'; ctx.beginPath();
      ctx.moveTo(cx - hw * 0.38, ty); ctx.lineTo(cx - hw * 0.38, ty - hh * 0.55); ctx.lineTo(cx - hw * 0.18, ty - hh * 0.28);
      ctx.lineTo(cx, ty - hh * 0.9); ctx.lineTo(cx + hw * 0.18, ty - hh * 0.28); ctx.lineTo(cx + hw * 0.38, ty - hh * 0.55);
      ctx.lineTo(cx + hw * 0.38, ty); ctx.closePath(); ctx.fill();
    } else if (id === 'hat8') {
      ctx.fillStyle = '#daa520'; ctx.beginPath(); ctx.ellipse(cx, ty - hh * 0.18, hw * 0.45, hh * 0.12, 0, 0, Math.PI * 2); ctx.fill();
    } else if (id === 'hat9') {
      ctx.fillStyle = '#4a2810'; ctx.beginPath(); ctx.arc(cx, ty - hh * 0.28, hw * 0.32, 0, Math.PI * 2); ctx.fill();
    } else if (id === 'hatsanta') {
      ctx.fillStyle = '#cc0000'; ctx.beginPath(); ctx.moveTo(cx, ty - hh); ctx.lineTo(cx - hw * 0.38, ty - hh * 0.08); ctx.lineTo(cx + hw * 0.38, ty - hh * 0.08); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(cx, ty - hh * 0.08, hw * 0.42, hh * 0.08, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx + hw * 0.28, ty - hh * 0.85, hw * 0.07, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = '#333'; ctx.beginPath(); ctx.ellipse(cx, ty - hh * 0.08, hw * 0.45, hh * 0.1, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(cx - hw * 0.28, ty - hh * 0.65, hw * 0.56, hh * 0.57);
    }
    ctx.restore();
  }

  _drBag(ctx, cx, y, cw, id) {
    ctx.save(); const bx = cx + cw * 0.55, bw = cw * 0.32, bh = cw * 0.28;
    if (id === 'bag1') {
      ctx.fillStyle = '#222'; ctx.fillRect(bx - bw/2, y - bh/2, bw, bh);
      ctx.fillStyle = '#444'; ctx.beginPath(); ctx.arc(bx, y, bw * 0.22, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff3333'; ctx.beginPath(); ctx.arc(bx + bw * 0.25, y - bh * 0.3, bw * 0.06, 0, Math.PI * 2); ctx.fill();
    } else if (id === 'bag2') {
      ctx.fillStyle = '#8B4513'; ctx.beginPath(); ctx.roundRect(bx - bw/2, y - bh/2, bw, bh, 3); ctx.fill();
      ctx.strokeStyle = '#5a2d0c'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(bx - bw * 0.25, y - bh/2); ctx.lineTo(bx - bw * 0.25, y - bh * 0.7);
      ctx.lineTo(bx + bw * 0.25, y - bh * 0.7); ctx.lineTo(bx + bw * 0.25, y - bh/2); ctx.stroke();
    } else if (id === 'bag3') {
      ctx.fillStyle = '#333'; ctx.beginPath(); ctx.roundRect(bx - bw/2, y - bh * 0.3, bw, bh * 0.6, 2); ctx.fill();
      ctx.fillStyle = '#55ccff'; ctx.fillRect(bx - bw * 0.4, y - bh * 0.25, bw * 0.8, bh * 0.45);
    } else if (id === 'bag4') {
      ctx.fillStyle = '#333'; ctx.beginPath(); ctx.roundRect(bx - bw/2, y - bh * 0.3, bw, bh * 0.6, 2); ctx.fill();
      ctx.fillStyle = '#1a3a5c'; ctx.fillRect(bx - bw * 0.4, y - bh * 0.25, bw * 0.8, bh * 0.45);
      ctx.strokeStyle = '#1fd67a'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(bx - bw * 0.3, y + bh * 0.08); ctx.lineTo(bx - bw * 0.1, y - bh * 0.02);
      ctx.lineTo(bx + bw * 0.1, y + bh * 0.02); ctx.lineTo(bx + bw * 0.3, y - bh * 0.12); ctx.stroke();
    } else {
      ctx.fillStyle = '#444'; ctx.fillRect(bx - bw/2, y - bh/2, bw, bh);
    }
    ctx.restore();
  }
}
