"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";

const LOGO_SRC = "/casibros-white.png";

type BrandLogoProps = {
  alt?: string;
  className?: string;
  fallbackClassName?: string;
  height: number;
  width: number;
};

export function BrandLogo({
  alt = "Casibros",
  className,
  fallbackClassName,
  height,
  width
}: BrandLogoProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span className={cn("inline-flex items-center font-semibold tracking-tight text-current", fallbackClassName)}>
        {alt}
      </span>
    );
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={LOGO_SRC}
      alt={alt}
      className={className}
      width={width}
      height={height}
      loading="eager"
      decoding="async"
      onError={() => {
        if (process.env.NODE_ENV !== "production") {
          // Helps catch asset path regressions during local development.
          console.warn(`Brand logo failed to load: ${LOGO_SRC}`);
        }
        setFailed(true);
      }}
    />
  );
}
