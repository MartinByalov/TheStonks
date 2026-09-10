/**
 * The Stonks — генератор на Stonk персонажи в браузър
 * Рисува слоеве в ред: background > chart > body > eyes > face_feature > dress > hat > bag
 */

export class StonkGenerator {
  constructor(opts = {}) {
    this.basePath = (opts.basePath || '.').replace(/\/$/, '');
    this.config = null;
    this.collection = null;
    this._tokenIndex = new Map();
    this._imageCache = new Map();
  }

  async load() {
    const [configRes, collectionRes] = await Promise.all([
      fetch(`${this.basePath}/data/traits-config.json`),
      fetch(`${this.basePath}/data/stonks-collection.json`),
    ]);
    
    if (!configRes.ok) throw new Error('Failed to load traits-config.json');
    if (!collectionRes.ok) throw new Error('Failed to load stonks-collection.json');

    this.config = await configRes.json();
    this.collection = await collectionRes.json();

    for (const token of this.collection.tokens) {
      this._tokenIndex.set(token.id, token);
    }
    return this;
  }

  get totalSupply() {
    return this.collection?.totalSupply || 0;
  }

  randomId() {
    return 1 + Math.floor(Math.random() * this.totalSupply);
  }

  _categoryByKey(key) {
    return this.config.categories.find((c) => c.key === key);
  }

  _optionMeta(categoryKey, optionId) {
    if (!optionId) return null;
    const cat = this._categoryByKey(categoryKey);
    return cat?.options.find((o) => o.id === optionId) || null;
  }

  _buildAssetPath(record, category, optionId) {
    if (!optionId) return null;
    
    const meta = this._optionMeta(category.key, optionId);
    if (!meta) return null;
    
    // Extract type number from bodyType (e.g. "body_type_1" → "1")
    const bodyTypeId = record.traits.bodyType;
    const typeMatch = bodyTypeId.match(/body_type_(\d)/);
    const typeNum = typeMatch ? typeMatch[1] : '1';
    
    let file = meta.file;
    // For body-type-dependent categories, substitute %TYPE%
    if (!category.bodyTypeAgnostic) {
      file = file.replace('%TYPE%', typeNum);
    }
    
    const folder = category.folder;
    
    // If not body-type-agnostic, add body type subfolder
    if (!category.bodyTypeAgnostic) {
      return `${folder}_type_${typeNum}/${file}`;
    }
    
    return `${folder}/${file}`;
  }

  _loadImage(path) {
    if (!path) return null;
    
    const cacheKey = path;
    if (this._imageCache.has(cacheKey)) {
      return this._imageCache.get(cacheKey);
    }

    const promise = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load ${cacheKey}`));
      img.src = `${this.basePath}/assets/${path}`;
    });

    this._imageCache.set(cacheKey, promise);
    return promise;
  }

  getStonk(tokenId) {
    const record = this._tokenIndex.get(Number(tokenId));
    if (!record) throw new Error(`No Stonk with id ${tokenId}`);

    const traits = [];
    for (const cat of this.config.categories) {
      const optionId = record.traits[cat.key];
      const meta = this._optionMeta(cat.key, optionId);
      traits.push({
        category: cat.key,
        label: cat.label,
        optionId: optionId,
        name: meta ? meta.name : 'None',
        rarityTier: meta?.rarityTier || 'common',
      });
    }

    return {
      id: record.id,
      traits,
      rarityScore: record.rarityScore,
      rarityRank: record.rarityRank,
      totalSupply: this.totalSupply,
    };
  }

  async render(tokenId, canvasEl, opts = {}) {
    const record = this._tokenIndex.get(Number(tokenId));
    if (!record) throw new Error(`No Stonk with id ${tokenId}`);

    const size = opts.size || 512;
    canvasEl.width = size;
    canvasEl.height = size;
    const ctx = canvasEl.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    ctx.imageSmoothingEnabled = false;

    // Layer order: background > chart > body > eyes > face_feature > dress > hat > bag
    const layerOrder = [
      'background',
      'chart',
      'body',
      'eyes',
      'faceFeature',
      'dress',
      'hat',
      'bag',
    ];

    for (const layerKey of layerOrder) {
      const category = this.config.categories.find((c) => c.key === layerKey);
      if (!category) continue;

      const optionId = record.traits[layerKey];
      if (!optionId) continue;

      const assetPath = this._buildAssetPath(record, category, optionId);
      if (!assetPath) continue;

      const img = await this._loadImage(assetPath);
      if (img) {
        ctx.drawImage(img, 0, 0, size, size);
      }
    }

    return canvasEl;
  }
}
