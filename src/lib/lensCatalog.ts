export interface LensBrandSuggestion {
  name: string;
  models: readonly string[];
}

export interface LensSuggestionSelection {
  brand: string;
  model: string;
}

const LENS_MODELS = {
  Canon: [
    "RF 24-105mm F4 L IS USM",
    "RF 50mm F1.8 STM",
    "RF 24-70mm F2.8 L IS USM",
    "RF 70-200mm F2.8 L IS USM",
    "RF-S 18-45mm F4.5-6.3 IS STM",
    "EF 50mm F1.8 STM",
    "FD 50mm F1.4",
    "FD 28mm F2.8",
  ],
  Nikon: [
    "NIKKOR Z 24-70mm F4 S",
    "NIKKOR Z 24-120mm F4 S",
    "NIKKOR Z 50mm F1.8 S",
    "NIKKOR Z 40mm F2",
    "AF-S NIKKOR 50mm F1.8G",
    "AF-S NIKKOR 24-70mm F2.8E ED VR",
    "AI-S NIKKOR 50mm F1.2",
    "AI-S NIKKOR 28mm F2.8",
  ],
  Sony: ["FE 24-70mm F2.8 GM II", "FE 24-105mm F4 G OSS", "FE 50mm F1.8", "FE 35mm F1.8", "E 18-135mm F3.5-5.6 OSS"],
  Sigma: ["24-70mm F2.8 DG DN II Art", "35mm F1.4 DG DN Art", "18-50mm F2.8 DC DN"],
  Tamron: ["28-75mm F2.8 Di III VXD G2", "17-70mm F2.8 Di III-A VC RXD", "70-180mm F2.8 Di III VC VXD G2"],
  Viltrox: ["AF 23mm F1.4", "AF 33mm F1.4", "AF 56mm F1.4"],
  Samyang: ["AF 35mm F1.8 FE", "AF 45mm F1.8 FE", "AF 75mm F1.8 FE"],
  Fujifilm: [
    "XF 18-55mm F2.8-4 R LM OIS",
    "XF 16-80mm F4 R OIS WR",
    "XF 35mm F1.4 R",
    "XF 23mm F2 R WR",
    "XF 16-55mm F2.8 R LM WR II",
    "XC 15-45mm F3.5-5.6 OIS PZ",
    "XF 35mm F1.4 R (manual focus mode)",
    "XF 27mm F2.8 R WR (manual focus mode)",
  ],
  Panasonic: [
    "LUMIX S 24-105mm F4 MACRO O.I.S.",
    "LUMIX S 50mm F1.8",
    "LUMIX G VARIO 12-60mm F3.5-5.6",
    "LUMIX G 25mm F1.7",
  ],
  Leica: [
    "Summicron-M 35mm F2 ASPH",
    "Summilux-M 50mm F1.4 ASPH",
    "Summicron-SL 50mm F2 ASPH",
    "Vario-Elmarit-SL 24-70mm F2.8 ASPH",
    "Summicron-M 50mm F2",
    "Elmarit-M 28mm F2.8",
  ],
  "OM System": [
    "M.Zuiko Digital ED 12-40mm F2.8 PRO II",
    "M.Zuiko Digital ED 12-45mm F4 PRO",
    "M.Zuiko Digital 25mm F1.8 II",
    "M.Zuiko Digital ED 40-150mm F4 PRO",
  ],
  Olympus: ["OM Zuiko 50mm F1.8", "OM Zuiko 50mm F1.4", "OM Zuiko 28mm F2.8"],
  "7Artisans": ["25mm F1.8", "35mm F1.4", "50mm F1.8", "60mm F2.8 Macro"],
  TTArtisan: ["11mm F2.8 Fisheye", "25mm F2", "35mm F1.4", "40mm F2.8 Macro", "50mm F1.2"],
  Pentax: [
    "HD PENTAX-DA 16-85mm F3.5-5.6 ED DC WR",
    "HD PENTAX-D FA 28-105mm F3.5-5.6 ED DC WR",
    "smc PENTAX-FA 50mm F1.4",
  ],
  Ricoh: ["GR III 18.3mm F2.8", "GR IIIx 26.1mm F2.8"],
  Hasselblad: ["XCD 28P", "XCD 38V", "XCD 55V", "XCD 90V"],
  Apple: ["Main Camera", "Ultra Wide Camera", "Telephoto Camera", "Periscope Telephoto Camera"],
  Huawei: ["Main Camera", "Ultra-Wide Camera", "Telephoto Camera", "Periscope Telephoto Camera", "Monochrome Camera"],
  Xiaomi: ["Main Camera", "Ultra-Wide Camera", "Telephoto Camera", "Periscope Telephoto Camera", "Macro Camera"],
  Oppo: ["Main Camera", "Ultra-Wide Camera", "Telephoto Camera", "Periscope Telephoto Camera", "Macro Camera"],
  OnePlus: ["Main Camera", "Ultra-Wide Camera", "Telephoto Camera", "Periscope Telephoto Camera", "Macro Camera"],
  Vivo: ["Main Camera", "Ultra-Wide Camera", "Telephoto Camera", "Periscope Telephoto Camera", "Macro Camera"],
  DJI: ["Integrated Wide-Angle Camera", "Integrated Tele Camera"],
  Insta360: ["Dual Fisheye Lenses", "Wide-Angle Lens", "Integrated Camera Lens"],
  Kodak: ["Built-in Lens", "Fixed Lens", "Standard Zoom Lens"],
} as const;

type LensBrand = keyof typeof LENS_MODELS;

interface CameraLensCatalogEntry {
  aliases: readonly string[];
  brands: readonly LensBrand[];
  interchangeable?: boolean;
}

const INTERCHANGEABLE_LENS_BRANDS: readonly LensBrand[] = [
  "Canon",
  "Nikon",
  "Sony",
  "Sigma",
  "Tamron",
  "Viltrox",
  "Samyang",
  "Fujifilm",
  "Panasonic",
  "Leica",
  "OM System",
  "Olympus",
  "Pentax",
  "Hasselblad",
  "7Artisans",
  "TTArtisan",
];

const CAMERA_LENS_CATALOG: readonly CameraLensCatalogEntry[] = [
  {
    aliases: ["canon"],
    brands: ["Canon", "Sigma", "Tamron", "Viltrox", "7Artisans", "TTArtisan"],
    interchangeable: true,
  },
  {
    aliases: ["nikon"],
    brands: ["Nikon", "Sigma", "Tamron", "Viltrox", "7Artisans", "TTArtisan"],
    interchangeable: true,
  },
  {
    aliases: ["sony"],
    brands: ["Sony", "Sigma", "Tamron", "Samyang", "Viltrox", "7Artisans", "TTArtisan"],
    interchangeable: true,
  },
  {
    aliases: ["fujifilm", "fuji"],
    brands: ["Fujifilm", "Sigma", "Tamron", "Viltrox", "7Artisans", "TTArtisan"],
    interchangeable: true,
  },
  {
    aliases: ["panasonic", "lumix"],
    brands: ["Panasonic", "Sigma", "Leica", "7Artisans", "TTArtisan"],
    interchangeable: true,
  },
  { aliases: ["leica"], brands: ["Leica", "Sigma", "7Artisans", "TTArtisan"], interchangeable: true },
  { aliases: ["olympus"], brands: ["Olympus", "OM System", "Sigma", "7Artisans", "TTArtisan"], interchangeable: true },
  {
    aliases: ["om digital", "om system"],
    brands: ["OM System", "Olympus", "Sigma", "7Artisans", "TTArtisan"],
    interchangeable: true,
  },
  { aliases: ["pentax"], brands: ["Pentax", "Sigma", "Tamron"], interchangeable: true },
  { aliases: ["ricoh"], brands: ["Ricoh", "Sigma"] },
  { aliases: ["hasselblad"], brands: ["Hasselblad"], interchangeable: true },
  { aliases: ["sigma"], brands: ["Sigma"], interchangeable: true },
  { aliases: ["apple"], brands: ["Apple"] },
  { aliases: ["huawei"], brands: ["Huawei"] },
  { aliases: ["xiaomi", "redmi", "poco"], brands: ["Xiaomi"] },
  { aliases: ["oppo"], brands: ["Oppo"] },
  { aliases: ["oneplus"], brands: ["OnePlus"] },
  { aliases: ["vivo"], brands: ["Vivo"] },
  { aliases: ["dji"], brands: ["DJI"] },
  { aliases: ["insta360"], brands: ["Insta360"] },
  { aliases: ["kodak"], brands: ["Kodak"] },
];

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function getLensBrands(cameraMake: string): readonly LensBrandSuggestion[] {
  const make = normalize(cameraMake);
  const entry = CAMERA_LENS_CATALOG.find(({ aliases }) => aliases.some((alias) => make.includes(normalize(alias))));
  const brands = entry?.interchangeable ? INTERCHANGEABLE_LENS_BRANDS : (entry?.brands ?? []);
  return brands.map((name) => ({ name, models: LENS_MODELS[name] }));
}

export function findLensSuggestion(cameraMake: string, value: string): LensSuggestionSelection | undefined {
  const normalizedValue = value.trim().toLowerCase();
  if (!normalizedValue) return undefined;
  for (const brand of getLensBrands(cameraMake)) {
    for (const model of brand.models) {
      if (`${brand.name} ${model}`.toLowerCase() === normalizedValue) return { brand: brand.name, model };
    }
  }
  return undefined;
}
