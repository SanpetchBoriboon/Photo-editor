"use client";

import { Button, Tooltip } from "@heroui/react";
import { ASPECT_PRESETS } from "@/lib/constants";
import { FlipIcon, RotateLeftIcon, RotateRightIcon } from "./icons";

interface CropPanelProps {
  aspectId: string;
  onSelectAspect: (id: string) => void;
  onRotate: (quarterTurns: number) => void;
  onFlip: () => void;
  onReset: () => void;
}

export function CropPanel({ aspectId, onSelectAspect, onRotate, onFlip, onReset }: CropPanelProps) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm text-default-500">สัดส่วนภาพ</h2>
      <div className="flex flex-wrap gap-2">
        {ASPECT_PRESETS.map((preset) => (
          <Button
            key={preset.id}
            size="sm"
            radius="full"
            color={preset.id === aspectId ? "primary" : "default"}
            variant={preset.id === aspectId ? "solid" : "flat"}
            onPress={() => onSelectAspect(preset.id)}
          >
            {preset.label}
          </Button>
        ))}
      </div>
      <p className="text-xs text-default-500">ลากกรอบหรือมุมบนรูปเพื่อกำหนดพื้นที่ crop</p>
      <h2 className="text-sm text-default-500">หมุน / พลิก</h2>
      <div className="flex gap-2">
        <Tooltip content="หมุนซ้าย 90°">
          <Button isIconOnly variant="flat" aria-label="หมุนซ้าย 90 องศา" onPress={() => onRotate(-1)}>
            <RotateLeftIcon />
          </Button>
        </Tooltip>
        <Tooltip content="หมุนขวา 90°">
          <Button isIconOnly variant="flat" aria-label="หมุนขวา 90 องศา" onPress={() => onRotate(1)}>
            <RotateRightIcon />
          </Button>
        </Tooltip>
        <Tooltip content="พลิกแนวนอน">
          <Button isIconOnly variant="flat" aria-label="พลิกแนวนอน" onPress={onFlip}>
            <FlipIcon />
          </Button>
        </Tooltip>
        <Button variant="light" onPress={onReset}>
          รีเซ็ตการตัดภาพ
        </Button>
      </div>
    </div>
  );
}
