"use client";

import Image from "next/image";
import Link from "next/link";
import { Button, ButtonGroup } from "@heroui/react";
import { AdjustIcon, BorderIcon, NextPhotoIcon } from "@/components/icons";
import { useLanguage } from "@/components/Providers";
import { APP_NAME } from "@/lib/brand";

export default function HomePage() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div className="home-shell">
      <header className="home-header">
        <p className="home-wordmark">{APP_NAME}</p>
        <ButtonGroup size="sm" variant="flat" aria-label={t("language")}>
          {(["th", "en"] as const).map((option) => (
            <Button
              key={option}
              className={
                language === option ? "bg-surface-raised text-text-primary" : "bg-surface-bar text-text-secondary"
              }
              onPress={() => setLanguage(option)}
            >
              {option.toUpperCase()}
            </Button>
          ))}
        </ButtonGroup>
      </header>
      <main className="home-main">
        <h1>{t("chooseWorkspace")}</h1>
        <div className="home-choices">
          <Link href="/edit" className="home-choice home-choice-edit">
            <div className="home-choice-media home-edit-preview" aria-hidden="true">
              <Image
                src="/workspace-mountain.jpg"
                alt=""
                fill
                sizes="(max-width: 767px) 100vw, 480px"
                loading="eager"
              />
              <span className="home-crop-preview" />
            </div>
            <div className="home-choice-label">
              <AdjustIcon />
              <h3>{t("photoEditor")}</h3>
              <NextPhotoIcon />
            </div>
          </Link>
          <Link href="/layout/collage" className="home-choice home-choice-layout">
            <div className="home-choice-media home-layout-preview" aria-hidden="true">
              <div>
                <Image src="/workspace-mountain.jpg" alt="" fill sizes="240px" loading="eager" />
              </div>
              <div>
                <Image src="/workspace-lake.jpg" alt="" fill sizes="240px" loading="eager" />
              </div>
              <div>
                <Image src="/workspace-lake.jpg" alt="" fill sizes="240px" loading="eager" />
              </div>
            </div>
            <div className="home-choice-label">
              <BorderIcon />
              <h3>{t("layoutEditor")}</h3>
              <NextPhotoIcon />
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
}
