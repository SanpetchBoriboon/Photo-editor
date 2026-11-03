import type { Metadata } from "next";
import { Sarabun } from "next/font/google";
import { Providers } from "@/components/Providers";
import { APP_NAME } from "@/lib/brand";
import "./globals.css";

const sarabun = Sarabun({
  subsets: ["latin", "thai"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  variable: "--font-sarabun",
});

export const metadata: Metadata = {
  title: `${APP_NAME} | Photo Editor`,
  description: "Crop, adjust and add borders with camera info to your photos",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`dark ${sarabun.variable}`}>
      <body className="bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
