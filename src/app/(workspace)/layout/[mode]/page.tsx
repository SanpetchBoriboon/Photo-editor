import { Suspense } from "react";
import { notFound } from "next/navigation";

const MODES = ["collage", "freeform", "print", "composition"];

export function generateStaticParams() {
  return MODES.map((mode) => ({ mode }));
}

async function ValidateLayoutMode({ params }: PageProps<"/layout/[mode]">) {
  const { mode } = await params;
  if (!MODES.includes(mode)) notFound();
  return null;
}

export default function LayoutModePage(props: PageProps<"/layout/[mode]">) {
  return (
    <Suspense fallback={null}>
      <ValidateLayoutMode {...props} />
    </Suspense>
  );
}