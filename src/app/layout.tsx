import type { Metadata } from "next";
import { Providers } from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Photo Editor",
  description: "Crop, adjust and add borders with camera info to your photos",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className="dark">
      <body className="bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
