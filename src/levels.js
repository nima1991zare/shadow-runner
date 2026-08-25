export const TOTAL_LEVELS = 1000;
export const LEVELS_PER_DISTRICT = 20;

export const DISTRICT_NAMES = [
  "The Old Quarter", "Saffron Alleys", "Silent Bazaar", "Garden of Dust", "Copper Citadel",
  "Moon Wells", "The Wind Towers", "Broken Caravan", "Turquoise Court", "Sunken Palace"
];

function mulberry32(seed) {
  return function random() {
    let value = seed += 0x6D2B79F5;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function between(random, min, max) {
  return min + random() * (max - min);
}

export function getDistrict(level) {
  return Math.floor((level - 1) / LEVELS_PER_DISTRICT) + 1;
}

export function getDistrictName(district) {
  const era = Math.floor((district - 1) / DISTRICT_NAMES.length);
  const base = DISTRICT_NAMES[(district - 1) % DISTRICT_NAMES.length];
  return era ? `${base} ${["II", "III", "IV", "V"][era - 1]}` : base;
}

export function generateLevel(level) {
  const safeLevel = Math.min(TOTAL_LEVELS, Math.max(1, Math.floor(level)));
  const random = mulberry32(safeLevel * 7919 + 17);
  const tier = (safeLevel - 1) / (TOTAL_LEVELS - 1);
  const buildingCount = Math.min(28, 12 + Math.floor(tier * 13) + safeLevel % 4);
  const buildings = [];

  // The canopy chain guarantees a readable route while the surrounding city changes.
  const canopies = [
    { x: -19, z: 18, width: 6, depth: 6, height: 3.4 },
    { x: 19, z: -18, width: 6, depth: 6, height: 3.4 }
  ];
  const canopyCount = 3 + Math.floor(tier * 3);
  for (let index = 0; index < canopyCount; index += 1) {
    const progress = (index + 1) / (canopyCount + 1);
    canopies.splice(canopies.length - 1, 0, {
      x: -19 + progress * 38 + between(random, -4, 4),
      z: 18 - progress * 36 + between(random, -4, 4),
      width: between(random, 4.5, 7),
      depth: between(random, 4.5, 7),
      height: between(random, 3.1, 4.2)
    });
  }

  const reserved = canopies.map((canopy) => ({
    x: canopy.x,
    z: canopy.z,
    halfX: canopy.width / 2 + 1.2,
    halfZ: canopy.depth / 2 + 1.2
  }));

  let attempts = 0;
  while (buildings.length < buildingCount && attempts < 300) {
    attempts += 1;
    const width = between(random, 2.8, 6.5);
    const depth = between(random, 2.8, 6.5);
    const candidate = {
      x: between(random, -19, 19),
      z: between(random, -19, 19),
      width,
      depth,
      height: between(random, 3.5, 9 + tier * 5),
      hue: random()
    };
    const blocked = reserved.some((spot) => Math.abs(candidate.x - spot.x) < width / 2 + spot.halfX && Math.abs(candidate.z - spot.z) < depth / 2 + spot.halfZ)
      || buildings.some((other) => Math.abs(candidate.x - other.x) < (width + other.width) / 2 + 1.7 && Math.abs(candidate.z - other.z) < (depth + other.depth) / 2 + 1.7);
    if (!blocked) buildings.push(candidate);
  }

  const relicIndexes = [1, Math.floor(canopies.length / 2), canopies.length - 2];
  const relics = relicIndexes.map((canopyIndex, index) => ({
    x: canopies[canopyIndex].x + between(random, -0.7, 0.7),
    z: canopies[canopyIndex].z + between(random, -0.7, 0.7),
    id: index
  }));

  return {
    level: safeLevel,
    district: getDistrict(safeLevel),
    buildings,
    canopies,
    relics,
    sunSpeed: 0.055 + tier * 0.055 + (safeLevel % 5) * 0.004,
    startAngle: -0.65 + random() * 0.7,
    parTime: Math.max(34, 76 - Math.floor(tier * 30) + (safeLevel % 7)),
    exposureRate: 16 + tier * 12,
    palette: Math.floor((safeLevel - 1) / 100) % 4
  };
}
