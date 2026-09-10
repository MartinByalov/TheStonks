#!/usr/bin/env node

/**
 * The Stonks
 * Collection generator
 *
 * Generates:
 * data/stonks-collection.json
 *
 * Supply:
 * 10,000 unique NFTs
 *
 * Required:
 * - Background
 * - Candle / Body
 *
 * Optional:
 * - Chart
 * - Eyes
 * - Face Feature
 * - Dress
 * - Hat
 * - Bag
 *
 * Optional traits can be None according to noneWeight.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

const CONFIG_PATH = join(
  HERE,
  'data',
  'traits-config.json'
);

const OUTPUT_PATH = join(
  HERE,
  'data',
  'stonks-collection.json'
);

const TOTAL_SUPPLY = 10000;
const COLLECTION_SEED = 'stonks-v1';


// ============================================================
// SEEDED RANDOM
// ============================================================

function hashSeed(str) {
  let h = 1779033703 ^ str.length;

  for (let i = 0; i < str.length; i++) {
    h = Math.imul(
      h ^ str.charCodeAt(i),
      3432918353
    );

    h = (h << 13) | (h >>> 19);
  }

  return () => {
    h = Math.imul(
      h ^ (h >>> 16),
      2246822507
    );

    h = Math.imul(
      h ^ (h >>> 13),
      3266489909
    );

    h ^= h >>> 16;

    return h >>> 0;
  };
}


function mulberry32(seed) {
  let a = seed;

  return () => {
    a |= 0;

    a =
      (a + 0x6d2b79f5) |
      0;

    let t =
      Math.imul(
        a ^ (a >>> 15),
        1 | a
      );

    t =
      (t +
        Math.imul(
          t ^ (t >>> 7),
          61 | t
        )) ^
      t;

    return (
      (t ^ (t >>> 14)) >>> 0
    ) / 4294967296;
  };
}


function makeRng(seedStr) {
  const seedFn = hashSeed(seedStr);
  return mulberry32(seedFn());
}


// ============================================================
// WEIGHTED CHOICE
// ============================================================

function weightedChoice(
  rng,
  options,
  noneWeight = 0
) {
  const validOptions =
    options.filter(
      (option) =>
        Number(option.weight) > 0
    );

  const optionWeight =
    validOptions.reduce(
      (sum, option) =>
        sum + Number(option.weight),
      0
    );

  const totalWeight =
    Number(noneWeight) +
    optionWeight;

  if (totalWeight <= 0) {
    return null;
  }

  const r =
    rng() * totalWeight;

  if (r < noneWeight) {
    return null;
  }

  let cumulative =
    noneWeight;

  for (const option of validOptions) {
    cumulative +=
      Number(option.weight);

    if (r < cumulative) {
      return option.id;
    }
  }

  return validOptions[
    validOptions.length - 1
  ].id;
}


// ============================================================
// MAIN
// ============================================================

function main() {
  console.log('');
  console.log('========================================');
  console.log(' The Stonks Collection Generator');
  console.log('========================================');
  console.log('');

  const config =
    JSON.parse(
      readFileSync(
        CONFIG_PATH,
        'utf8'
      )
    );

  const bodyTypes =
    config.bodyTypes || [];

  const categories =
    config.categories || [];

  if (!bodyTypes.length) {
    throw new Error(
      'No bodyTypes found in traits-config.json'
    );
  }

  if (!categories.length) {
    throw new Error(
      'No categories found in traits-config.json'
    );
  }

  const rng =
    makeRng(COLLECTION_SEED);

  const seenCombos =
    new Set();

  const collection =
    [];

  let attempts = 0;


  // ==========================================================
  // GENERATE 10,000 UNIQUE TOKENS
  // ==========================================================

  for (
    let tokenId = 1;
    tokenId <= TOTAL_SUPPLY;
    tokenId++
  ) {
    let traits;
    let comboKey;

    while (true) {
      attempts++;

      // ------------------------------------------------------
      // BODY TYPE
      // ------------------------------------------------------

      const bodyTypeIndex =
        weightedChoice(
          rng,
          bodyTypes.map(
            (bodyType, index) => ({
              id: index,
              weight:
                bodyType.weight
            })
          )
        );

      const selectedBodyType =
        bodyTypes[
          bodyTypeIndex
        ];

      if (!selectedBodyType) {
        throw new Error(
          'Failed to select body type'
        );
      }

      traits = {
        bodyType:
          selectedBodyType.id
      };


      // ------------------------------------------------------
      // TRAITS
      // ------------------------------------------------------

      for (const category of categories) {
        const options =
          category.options || [];

        let noneWeight = 0;

        /*
         * Required categories:
         * None is never allowed.
         */
        if (
          category.required === true
        ) {
          noneWeight = 0;
        } else {
          noneWeight =
            Number(
              category.noneWeight || 0
            );
        }

        traits[category.key] =
          weightedChoice(
            rng,
            options,
            noneWeight
          );
      }


      // ------------------------------------------------------
      // UNIQUE COMBINATION KEY
      // ------------------------------------------------------

      comboKey = [
        traits.bodyType,
        ...categories.map(
          (category) =>
            traits[category.key] ===
            null
              ? 'NONE'
              : traits[category.key]
        )
      ].join('|');


      if (
        !seenCombos.has(comboKey)
      ) {
        seenCombos.add(
          comboKey
        );

        break;
      }
    }


    collection.push({
      id: tokenId,
      traits
    });
  }


  // ==========================================================
  // CONFIGURED TRAIT PROBABILITIES
  // ==========================================================

  const frequency = {};


  for (const category of categories) {
    const options =
      category.options || [];

    const noneWeight =
      category.required === true
        ? 0
        : Number(
            category.noneWeight || 0
          );

    const optionWeight =
      options.reduce(
        (sum, option) =>
          sum +
          Number(option.weight || 0),
        0
      );

    const totalWeight =
      noneWeight +
      optionWeight;

    frequency[category.key] = {};


    if (noneWeight > 0) {
      frequency[
        category.key
      ].NONE =
        noneWeight /
        totalWeight;
    }


    for (const option of options) {
      frequency[
        category.key
      ][option.id] =
        Number(option.weight || 0) /
        totalWeight;
    }
  }


  // ==========================================================
  // BODY TYPE PROBABILITIES
  // ==========================================================

  const bodyTypeFrequency = {};

  const totalBodyTypeWeight =
    bodyTypes.reduce(
      (sum, bodyType) =>
        sum +
        Number(
          bodyType.weight || 0
        ),
      0
    );


  for (const bodyType of bodyTypes) {
    bodyTypeFrequency[
      bodyType.id
    ] =
      Number(
        bodyType.weight || 0
      ) /
      totalBodyTypeWeight;
  }


  // ==========================================================
  // RARITY SCORE
  // ==========================================================

  for (const token of collection) {
    let rarityScore = 0;


    // Body type rarity
    const bodyTypeProbability =
      bodyTypeFrequency[
        token.traits.bodyType
      ] || 0.0001;

    rarityScore +=
      1 /
      bodyTypeProbability;


    // Trait rarity
    for (const category of categories) {
      const value =
        token.traits[
          category.key
        ];

      const frequencyKey =
        value === null
          ? 'NONE'
          : value;

      const probability =
        frequency[
          category.key
        ]?.[frequencyKey] ||
        0.0001;

      rarityScore +=
        1 / probability;
    }


    token.rarityScore =
      Math.round(
        rarityScore * 1000
      ) / 1000;
  }


  // ==========================================================
  // RARITY RANK
  // ==========================================================

  const ranked =
    [...collection].sort(
      (a, b) => {
        if (
          b.rarityScore !==
          a.rarityScore
        ) {
          return (
            b.rarityScore -
            a.rarityScore
          );
        }

        return a.id - b.id;
      }
    );


  ranked.forEach(
    (token, index) => {
      token.rarityRank =
        index + 1;
    }
  );


  // ==========================================================
  // RESTORE TOKEN ID ORDER
  // ==========================================================

  collection.sort(
    (a, b) =>
      a.id - b.id
  );


  // ==========================================================
  // STATISTICS
  // ==========================================================

  const bodyTypeCounts = {};

  for (const bodyType of bodyTypes) {
    bodyTypeCounts[
      bodyType.id
    ] = 0;
  }


  let goldenCount = 0;


  for (const token of collection) {
    const bodyType =
      token.traits.bodyType;

    bodyTypeCounts[
      bodyType
    ]++;


    if (
      token.traits.body ===
      'golden'
    ) {
      goldenCount++;
    }
  }


  // ==========================================================
  // OUTPUT
  // ==========================================================

  const output = {
    totalSupply:
      TOTAL_SUPPLY,

    seed:
      COLLECTION_SEED,

    generatedWithAttempts:
      attempts,

    generatedAt:
      new Date().toISOString(),

    tokens:
      collection
  };


  writeFileSync(
    OUTPUT_PATH,
    JSON.stringify(
      output,
      null,
      2
    ),
    'utf8'
  );


  // ==========================================================
  // CONSOLE REPORT
  // ==========================================================

  console.log(
    `✓ Generated ${TOTAL_SUPPLY} unique Stonks`
  );

  console.log('');

  console.log(
    `Output: ${OUTPUT_PATH}`
  );

  console.log(
    `Attempts: ${attempts}`
  );

  console.log(
    `Collisions: ${
      attempts - TOTAL_SUPPLY
    }`
  );

  console.log('');

  console.log(
    'Body type distribution:'
  );

  for (const bodyType of bodyTypes) {
    const count =
      bodyTypeCounts[
        bodyType.id
      ] || 0;

    const percentage =
      (
        (count /
          TOTAL_SUPPLY) *
        100
      ).toFixed(2);

    console.log(
      `  ${bodyType.id}: ${count} (${percentage}%)`
    );
  }

  console.log('');

  console.log(
    `Golden candles: ${goldenCount} (${(
      (goldenCount /
        TOTAL_SUPPLY) *
      100
    ).toFixed(2)}%)`
  );

  console.log('');

  console.log(
    'Done.'
  );

  console.log('');
}


main();