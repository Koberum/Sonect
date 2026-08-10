import { cn, hoverStyles } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface CollageProps {
  images: string[];
  aspectRatio?: "portrait" | "square";
}

export function ImageCollage({ images, aspectRatio = "square" }: CollageProps) {
  const { t } = useTranslation();
  // If less than 4 images, just show the first one full
  if (images.length < 4) {
    return (
      <div
        className={cn(
          "overflow-hidden rounded-md",
          aspectRatio === "portrait" ? "aspect-[3/4]" : "aspect-square",
        )}
      >
        <img
          src={images[0]}
          alt={t("common.cover")}
          className={cn("h-full w-full object-cover", hoverStyles)}
        />
      </div>
    );
  }

  // Show 2x2 collage with first 4 images
  const collageImages = images.slice(0, 4);

  return (
    <div
      className={cn(
        "grid grid-cols-2 grid-rows-2 gap-0 transition-all group-hover:scale-105",
        aspectRatio === "portrait" ? "aspect-[3/4]" : "aspect-square",
      )}
    >
      {collageImages.map((src, index) => (
        <img
          key={index}
          src={src}
          alt={t("common.collageImage", { index: index + 1 })}
          className="h-full w-full object-cover transition-all group-hover:brightness-75"
        />
      ))}
    </div>
  );
}
