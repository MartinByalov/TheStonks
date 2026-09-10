#!/usr/bin/env node
/**
 * Генерира data/stonks-collection.json - таблица от 10 000 гарантирано
 * уникални комбинации. Управлява body_type зависимостта (останалите слоеве 
 * имат папки за всеки body type).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(HERE, 'data', 'traits-config.json');
const OUTPUT_PATH = join(HERE, 'data', 'stonks-collection.json');

const TOTAL_SUPPLY = 10000;
const COLLECTION_SEED = 'stonks-v1';

// --- Seeded PRNG ---
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
function makeRng(seedStr) {
  const seedFn = hashSeed(seedStr);
  return mulberry32(seedFn());
}

function weightedChoice(rng, options, noneWeight = 0) {
  const total = noneWeight + options.reduce((s, o) => s + o.weight, 0);
  const r = rng() * total;
  if (r < noneWeight) return null;
  let upto = noneWeight;
  for (const opt of options) {
    upto += opt.weight;
    if (r <= upto) return opt.id;
  }
  return options.length ? options[options.length - 1].id : null;
}

function main() {
  const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
  const bodyTypes = config.bodyTypes;
  const categories = config.categories;
  const rng = makeRng(COLLECTION_SEED);

  const seenCombos = new Set();
  const collection = [];
  let attempts = 0;

  for (let tokenId = 1; tokenId <= TOTAL_SUPPLY; tokenId++) {
    let traits;
    let comboKey;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      attempts++;
      
      // Избираме body_type първо
      const bodyTypeIndex = weightedChoice(rng, bodyTypes.map((bt, idx) => ({ 
        id: idx, 
        weight: bt.weight 
      })));
      const selectedBodyType = bodyTypes[bodyTypeIndex];
      
      traits = { bodyType: selectedBodyType.id };
      
      // За всяка категория избираме трейт
      for (const cat of categories) {
        if (cat.key === 'body') {
          // Body е специален - зависи от body_type
          const noneWeight = cat.required ? 0 : (cat.noneWeight || 0);
          traits.body = weightedChoice(rng, cat.options, noneWeight);
        } else if (cat.bodyTypeAgnostic) {
          // Фон и графика не зависят от body_type
          const noneWeight = cat.required ? 0 : (cat.noneWeight || 0);
          traits[cat.key] = weightedChoice(rng, cat.options, noneWeight);
        } else {
          // Всички други зависят от body_type
          const noneWeight = cat.required ? 0 : (cat.noneWeight || 0);
          traits[cat.key] = weightedChoice(rng, cat.options, noneWeight);
        }
      }
      
      // Ключ за уникалност: body_type + всички трейти
      comboKey = `${traits.bodyType}|${
        categories.map(c => traits[c.key]).join('|')
      }`;
      
      if (!seenCombos.has(comboKey)) {
        seenCombos.add(comboKey);
        break;
      }
    }
    
    collection.push({ id: tokenId, traits });
  }

  // --- Rarity score ---
  const freq = {};
  for (const cat of categories) {
    const noneWeight = cat.required ? 0 : (cat.noneWeight || 0);
    const totalW = noneWeight + cat.options.reduce((s, o) => s + o.weight, 0);
    freq[cat.key] = {};
    if (noneWeight) freq[cat.key]['null'] = noneWeight / totalW;
    for (const o of cat.options) {
      freq[cat.key][o.id] = o.weight / totalW;
    }
  }
  
  // Тежест за body_type
  const bodyTypeFreq = {};
  const totalBT = bodyTypes.reduce((s, bt) => s + bt.weight, 0);
  for (const bt of bodyTypes) {
    bodyTypeFreq[bt.id] = bt.weight / totalBT;
  }

  for (const entry of collection) {
    let score = 0;
    score += 1 / (bodyTypeFreq[entry.traits.bodyType] || 0.001);
    for (const cat of categories) {
      const val = entry.traits[cat.key];
      const p = freq[cat.key][val === null ? 'null' : val] ?? 0.0001;
      score += 1 / p;
    }
    entry.rarityScore = Math.round(score * 1000) / 1000;
  }

  const ranked = [...collection].sort((a, b) => b.rarityScore - a.rarityScore);
  ranked.forEach((entry, i) => {
    entry.rarityRank = i + 1;
  });

  collection.sort((a, b) => a.id - b.id);

  const output = {
    totalSupply: TOTAL_SUPPLY,
    seed: COLLECTION_SEED,
    generatedWithAttempts: attempts,
    tokens: collection,
  };

  writeFileSync(OUTPUT_PATH, JSON.stringify(output));

  console.log(`✓ ${TOTAL_SUPPLY} уникални Stonks записани в ${OUTPUT_PATH}`);
  console.log(`  Всичко опити: ${attempts}`);
  console.log(`  Преповторения (collisions): ${attempts - TOTAL_SUPPLY}`);
}

main();
