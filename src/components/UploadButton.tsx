"use client";

import { useRef } from "react";
import { Button } from "@heroui/react";
import { ALLOWED_IMAGE_TYPES } from "@/lib/constants";
import { UploadIcon } from "./icons";

interface UploadButtonProps {
  label: string;
  multiple?: boolean;
  isDisabled?: boolean;
  onFiles: (files: File[]) => void;
}

export function UploadButton({ label, multiple = false, isDisabled = false, onFiles }: UploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <Button
        variant="bordered"
        isDisabled={isDisabled}
        startContent={<UploadIcon />}
        onPress={() => inputRef.current?.click()}
      >
        {label}
      </Button>
      <input
        ref={inputRef}
        hidden
        type="file"
        multiple={multiple}
        accept={ALLOWED_IMAGE_TYPES.join(",")}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          // Reset so selecting the same files again still fires onChange.
          event.target.value = "";
          if (files.length > 0) onFiles(files);
        }}
      />
    </>
  );
}
