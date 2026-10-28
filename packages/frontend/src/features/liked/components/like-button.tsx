import { Heart } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToggleLike } from "../useToggleLike";

type LikeButtonProps = {
  trackId?: number | null;
  className?: string;
};

function LikeButtonInner({
  trackId,
  className,
}: {
  trackId: number;
  className?: string;
}) {
  const { t } = useTranslation();
  const { liked, isPending, toggle } = useToggleLike(trackId);

  return (
    <Button
      type="button"
      variant="bare"
      size="icon-sm"
      aria-label={liked ? t("liked.unlike") : t("liked.like")}
      aria-pressed={liked}
      disabled={isPending}
      className={cn(
        "shrink-0",
        liked
          ? "text-primary hover:text-primary"
          : "text-muted-foreground hover:text-foreground",
        className,
      )}
      onClick={(event) => {
        event.stopPropagation();
        event.preventDefault();
        toggle();
      }}
    >
      <Heart className={liked ? "fill-current" : undefined} />
    </Button>
  );
}

export function LikeButton({ trackId, className }: LikeButtonProps) {
  if (!trackId) return null;
  return <LikeButtonInner trackId={trackId} className={className} />;
}
