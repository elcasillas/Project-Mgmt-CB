"use client";

import Image from "next/image";
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
    <Image
      src={LOGO_SRC}
      alt={alt}
      width={width}
      height={height}
      className={className}
      priority
      unoptimized
      onError={() => setFailed(true)}
    />
  );
}
