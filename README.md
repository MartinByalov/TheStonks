# The Stonks — 10,000 Уникални NFT Персонажа

**Браузърен генератор** който рисува 10,000 гарантирано уникални "Stonk" персонажа чрез композиране на пиксел-арт слоеве.

## Как Работи

Всеки Stonk е съставен от **8 слоя**, рисувани в точния ред:

1. **Background** — 10 градиентни фона
2. **Chart** — 5 борсови графики (опционално)
3. **Body** — 3 body type × 3 цвята (зелена/червена/златна свещ)
4. **Eyes** — 14 варианта очи (опционално, зависи от body type)
5. **Face Feature** — 8 лицеви черти (опционално, зависи от body type)
6. **Dress** — 8 варианта облекло (опционално, зависи от body type)
7. **Hat** — 17 варианта шапки (опционално, зависи от body type)
8. **Bag** — 4 аксесоара (опционално, зависи от body type)

### Зависимост: Body Type

Асетите са организирани по **body type** (3 типа). Всеки body type има своите варианти за очи, облекло, шапки и т.н. При генериране, след избора на body type, всички други слоеве автоматично работят със съответния папки на този body type.

**Пример:** Ако генераторът избере `body_type_1`, тогава очите се зареждат от `eyes_type_1`, шапката от `hats_type_1` и т.н.

### Rarity (Редкост)

**Golden candlesticks** имат вес 4 (срещу 32 за зелени и червени), което ги прави **~8x по-редки**.

Останалите слоеве имат еднакви тежести, освен че някои слоеве имат вис `noneWeight` (опционални трейтове).

## Файловна Структура

```
The_Stonks_Generator/
├── index.html                      демо страница
├── js/
│   └── stonk-generator.js          браузърен генератор (ES6 модул)
├── data/
│   ├── traits-config.json          конфигурация на слоевете
│   └── stonks-collection.json      10,000-те уникални комбинации
├── assets/
│   ├── background/                 фон пиксели
│   ├── charts/                     борсови графики
│   ├── body_types/                 тела (свещи) по type
│   ├── eyes_type_1/, eyes_type_2/, eyes_type_3/
│   ├── face_feature_type_1/...
│   ├── dress_type_1/...
│   ├── hats_type_1/...
│   └── bag_body_type_1/...         аксесоари
├── generate-collection.mjs         build script (Node.js)
└── README.md                        този файл
```

## Пускане

### Локално Тестване

```bash
npx serve .
# → http://localhost:3000
```

Натисни "Генерирай Stonk" за случаен персонаж от 10,000-те.

### На Сайта

1. Копирай `assets/`, `data/` и `js/` в твоя сайт (напр. `public/stonks/`).
2. Импортирай генератора:

```javascript
import { StonkGenerator } from '/stonks/js/stonk-generator.js';

const gen = new StonkGenerator({ basePath: '/stonks' });
await gen.load();

const id = gen.randomId();                // случаен номер 1–10000
const info = gen.getStonk(id);            // трейти, име, рarity rank
await gen.render(id, canvasElement, { size: 512 });
```

## API

### `StonkGenerator(opts)`

```javascript
const gen = new StonkGenerator({ basePath: '/stonks' });
```

**Методи:**

- `await gen.load()` — зарежда config + collection. Извиква се **веднъж** при старт.
- `gen.randomId()` — връща случайно число 1–10000.
- `gen.getStonk(id)` — връща `{ id, traits[], rarityScore, rarityRank, totalSupply }`.
- `await gen.render(id, canvas, { size: 512 })` — рисува Stonk #id на canvas.

## Регенериране на Колекцията

Ако искаш да **промениш тежестите** на трейтове (напр. още по-редки golden):

1. Редактирай `data/traits-config.json` (полета `weight` и `noneWeight`).
2. Пусни:

```bash
node generate-collection.mjs
```

Това произвежда **нова** `stonks-collection.json` с 10,000 уникални комбинации при новите тежести. При следващо пускане на браузъра, той ще изтегли новия JSON.

**Забележка:** tokenId-то на konkretne Stonk **няма да пада на същата комбинация** при регенериране (разбъркването се променя), но самата колекция остава 10,000 уникални с новите вероятности.

## Технически Детайли

- **No Dependencies**: Генератора е чист JavaScript. Нямане на React, Vue или други библиотеки.
- **Deterministic**: Stonk #4242 винаги ще має същите трейтове и ще изглежда еднакво за всички посетители.
- **Seeded RNG**: Генерирането използва seeded Mersenne Twister за повторяемост.
- **Conflict Resolution**: При редко повторение на комбинация, генератора просто хвърля зара отново за този token.

## Golden Rarity

Golden candlesticks имат тежест **4** срещу **32** за зелени/червени:

- Вероятност за golden при един body_type: 4 / (4+32+32) = ~5%
- При 3 body_types и均равен избор: ~5% глобално

При 10,000 Stonks, очакваш около **500 golden candlesticks** (някъде 5–6% от колекцията).

## Контакт

За въпроси, грешки или идеи за разширение — редактирай `traits-config.json` и `js/stonk-generator.js` директно или регенерирай колекцията с нови параметри.
