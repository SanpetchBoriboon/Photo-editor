import { Suspense } from "react";
import { Editor } from "@/components/Editor";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <Editor />
      </Suspense>
      {children}
    </>
  );
}