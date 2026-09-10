/**
 * The Stonks — генератор на пикселови NFT изображения
 * ----------------------------------------------------
 * Чисто клиентски (браузърен), zero-dependency ES модул.
 *
 * Как работи:
 *  - data/traits-config.json описва слоевете (background, body, dress, ...),
 *    реда им (отдолу нагоре) и файловете/тежестите за rarity. Всичките 7
 *    тела споделят ЕДНАКВА геометрия (глава/очи/уста на един и същи ред),
 *    затова не е нужна никаква корекция на позицията между слоевете.
 *  - Категорията "chart" НЕ е PNG слой - тя се рисува процедурно (права
 *    линия със зелени/червени сегменти, случайно движение нагоре/надолу),
 *    директно върху финалния canvas, гладко (anti-aliased), за контраст с
 *    пиксела на героя.
 *  - data/stonks-collection.json съдържа ПРЕДГЕНЕРИРАНА таблица от 10 000
 *    гарантирано уникални комбинации (виж generate-collection.mjs).
 *
 * Публично API:
 *   const gen = new StonkGenerator({ basePath: '/stonks' });
 *   await gen.load();
 *   const info = gen.getStonk(1234);           // traits + rarity + имена
 *   await gen.render(1234, canvasEl, { size: 480 });
 *   const id = gen.randomId();                  // случаен номер 1..10000
 */

// --- малък детерминиран PRNG (mulberry32 + string hash), за графиката ---
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
  return mulberry32(hashSeed(`stonk-chart-${tokenId}-${salt}`)());
}

/**
 * Генерира точките на "борсовата" линия за даден chart стил и ги рисува
 * директно на финалния canvas (гладко, не pixel-art), сегмент по сегмент,
 * зелено при качване, червено при спад — като истинска свещна графика.
 */
function drawChartLine(ctx, size, tokenId, style) {
  const rng = rngFor(tokenId, style);
  const points = 9 + Math.floor(rng() * 4); // 9-12 точки
  const marginX = size * 0.06;
  const marginTop = size * 0.14;
  const marginBottom = size * 0.30; // оставя място за героя долу
  const usableW = size - marginX * 2;
  const usableH = size - marginTop - marginBottom;

  const bias = { uptrend: -0.62, downtrend: 0.62, choppy: 0 }[style] ?? 0;

  let y = marginTop + usableH * (style === 'uptrend' ? 0.8 : style === 'downtrend' ? 0.2 : 0.5);
  const ys = [y];
  for (let i = 1; i < points; i++) {
    const step = (rng() - 0.5 + bias) * usableH * 0.42;
    y = Math.min(marginTop + usableH, Math.max(marginTop, y + step));
    ys.push(y);
  }

  const dx = usableW / (points - 1);
  const lineWidth = Math.max(1.5, size * 0.012);

  ctx.save();
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = size * 0.01;

  for (let i = 1; i < ys.length; i++) {
    const x0 = marginX + dx * (i - 1);
    const x1 = marginX + dx * i;
    const up = ys[i] < ys[i - 1]; // по-малко y = по-нагоре на екрана = "расте"
    ctx.strokeStyle = up ? '#1fd67a' : '#ef4444';
    ctx.beginPath();
    ctx.moveTo(x0, ys[i - 1]);
    ctx.lineTo(x1, ys[i]);
    ctx.stroke();
  }
  ctx.restore();
}

export class StonkGenerator {
  /**
   * @param {Object} opts
   * @param {string} opts.basePath - път до папката, съдържаща /assets и /data
   *   (напр. '/stonks' ако структурата е качена в public/stonks/...).
   */
  constructor(opts = {}) {
    this.basePath = (opts.basePath || '.').replace(/\/$/, '');
    this.config = null;
    this.collection = null;
    this._tokenIndex = null; // id -> record (за O(1) достъп)
    this._imageCache = new Map(); // "category/file" -> HTMLImageElement (Promise)
  }

  /** Зарежда traits-config.json и stonks-collection.json. Извиква се веднъж. */
  async load() {
    const [configRes, collectionRes] = await Promise.all([
      fetch(`${this.basePath}/data/traits-config.json`),
      fetch(`${this.basePath}/data/stonks-collection.json`),
    ]);
    if (!configRes.ok) throw new Error('Не успях да заредя traits-config.json');
    if (!collectionRes.ok) throw new Error('Не успях да заредя stonks-collection.json');

    this.config = await configRes.json();
    this.collection = await collectionRes.json();

    this._tokenIndex = new Map();
    for (const token of this.collection.tokens) {
      this._tokenIndex.set(token.id, token);
    }
    return this;
  }

  get totalSupply() {
    return this.collection ? this.collection.totalSupply : 0;
  }

  /** Връща случаен tokenId в диапазона [1, totalSupply]. */
  randomId() {
    return 1 + Math.floor(Math.random() * this.totalSupply);
  }

  _categoryByKey(key) {
    return this.config.categories.find((c) => c.key === key);
  }

  _optionMeta(categoryKey, optionId) {
    if (optionId === null || optionId === undefined) return null;
    const cat = this._categoryByKey(categoryKey);
    return cat.options.find((o) => o.id === optionId) || null;
  }

  /**
   * Връща пълна информация за даден Stonk: суровите traits, човешки имена,
   * rarity score и rank. Не изисква canvas / зареждане на картинки.
   */
  getStonk(tokenId) {
    const record = this._tokenIndex.get(Number(tokenId));
    if (!record) throw new Error(`Няма Stonk с id ${tokenId}`);

    const traits = this.config.categories.map((cat) => {
      const optionId = record.traits[cat.key];
      const meta = this._optionMeta(cat.key, optionId);
      return {
        category: cat.key,
        label: cat.label,
        optionId: optionId,
        name: meta ? meta.name : 'Няма',
        rarityTier: meta && meta.rarityTier ? meta.rarityTier : 'common',
      };
    });

    return {
      id: record.id,
      traits,
      rarityScore: record.rarityScore,
      rarityRank: record.rarityRank,
      totalSupply: this.totalSupply,
    };
  }

  _loadImage(category, file) {
    const cacheKey = `${category}/${file}`;
    if (this._imageCache.has(cacheKey)) return this._imageCache.get(cacheKey);

    const promise = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Неуспешно зареждане на ${cacheKey}`));
      img.src = `${this.basePath}/assets/${category}/${file}`;
    });

    this._imageCache.set(cacheKey, promise);
    return promise;
  }

  /** Предварително зарежда всички PNG изображения (по избор — за по-бърз първи рендер). */
  async preloadAll() {
    const jobs = [];
    for (const cat of this.config.categories) {
      if (cat.renderMode === 'procedural') continue; // chart - няма PNG
      for (const opt of cat.options) {
        jobs.push(this._loadImage(cat.folder, opt.file));
      }
    }
    await Promise.all(jobs);
  }

  /**
   * Рендерира даден Stonk върху canvas елемент.
   * @param {number} tokenId
   * @param {HTMLCanvasElement} canvasEl
   * @param {Object} [opts]
   * @param {number} [opts.size] - изходен размер в px (canvas е квадратен). По подразбиране 24 * 15 = 360.
   */
  async render(tokenId, canvasEl, opts = {}) {
    const record = this._tokenIndex.get(Number(tokenId));
    if (!record) throw new Error(`Няма Stonk с id ${tokenId}`);

    const N = this.config.canvasSize || 24;
    const size = opts.size || N * 15;

    canvasEl.width = size;
    canvasEl.height = size;
    const ctx = canvasEl.getContext('2d');
    ctx.clearRect(0, 0, size, size);

    // helper: композира дадени PNG категории в native 24x24 offscreen canvas,
    // после ги качва (nearest-neighbor, остри пиксели) на финалния canvas.
    const drawPixelLayers = async (categoryKeys) => {
      const off = document.createElement('canvas');
      off.width = N;
      off.height = N;
      const offCtx = off.getContext('2d');
      offCtx.imageSmoothingEnabled = false;
      offCtx.clearRect(0, 0, N, N);

      for (const cat of this.config.categories) {
        if (!categoryKeys.includes(cat.key)) continue;
        const optionId = record.traits[cat.key];
        if (!optionId) continue;
        const meta = this._optionMeta(cat.key, optionId);
        if (!meta) continue;
        const img = await this._loadImage(cat.folder, meta.file);
        offCtx.drawImage(img, 0, 0, N, N);
      }

      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(off, 0, 0, size, size);
    };

    // 1) фон (pixel-art, долен слой)
    await drawPixelLayers(['background']);

    // 2) графика на фон — рисува се процедурно, ГЛАДКО (не pixel-art),
    //    за визуален контраст с героя отгоре.
    const chartOptionId = record.traits.chart;
    const chartMeta = this._optionMeta('chart', chartOptionId);
    if (chartMeta) {
      ctx.imageSmoothingEnabled = true;
      drawChartLine(ctx, size, record.id, chartMeta.style);
    }

    // 3) героят и всички аксесоари (pixel-art, отгоре)
    await drawPixelLayers(['body', 'dress', 'bodyfeature', 'eyes', 'facefeature', 'hat', 'bag']);

    return canvasEl;
  }
}
