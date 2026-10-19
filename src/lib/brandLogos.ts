import {
  siApple,
  siDji,
  siFujifilm,
  siHuawei,
  siInsta360,
  siKodak,
  siLeica,
  siNikon,
  siOppo,
  siOneplus,
  siPanasonic,
  siSony,
  siVivo,
  siXiaomi,
} from "simple-icons";
import type { SimpleIcon } from "simple-icons";

const CAMERA_BRAND_ICONS: readonly { aliases: readonly string[]; icon: SimpleIcon }[] = [
  { aliases: ["apple"], icon: siApple },
  { aliases: ["dji"], icon: siDji },
  { aliases: ["fujifilm", "fuji"], icon: siFujifilm },
  { aliases: ["huawei"], icon: siHuawei },
  { aliases: ["insta360"], icon: siInsta360 },
  { aliases: ["kodak"], icon: siKodak },
  { aliases: ["leica"], icon: siLeica },
  { aliases: ["nikon"], icon: siNikon },
  { aliases: ["oppo"], icon: siOppo },
  { aliases: ["oneplus"], icon: siOneplus },
  { aliases: ["panasonic", "lumix"], icon: siPanasonic },
  { aliases: ["sony"], icon: siSony },
  { aliases: ["vivo"], icon: siVivo },
  { aliases: ["xiaomi", "redmi", "poco"], icon: siXiaomi },
];

export function findBrandLogo(make: string): SimpleIcon | undefined {
  const normalized = make.toLowerCase().replace(/[^a-z0-9]/g, "");
  return CAMERA_BRAND_ICONS.find(({ aliases }) =>
    aliases.some((alias) => normalized.includes(alias.replace(/[^a-z0-9]/g, ""))),
  )?.icon;
}