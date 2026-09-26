const PlayStatusVariant = {
  Primary: "primary",
  white: "white",
} as const;

type PlayStatusVariant =
  (typeof PlayStatusVariant)[keyof typeof PlayStatusVariant];
export interface PlayStatusProps {
  className?: string;
  variant?: PlayStatusVariant;
}

export default function PlayStatus({ className, variant }: PlayStatusProps) {
  const resolvedVariant = variant || PlayStatusVariant.Primary;
  const variantClass =
    resolvedVariant === PlayStatusVariant.Primary ? "bg-primary" : "bg-white";

  return (
    <div className={`flex items-end gap-1 ${className || ""}`}>
      <div
        className={`${variantClass} eq h-1 w-1 rounded`}
        style={{ animationDelay: "0ms" }}
      />
      <div
        className={`${variantClass} eq h-2 w-1 rounded`}
        style={{ animationDelay: "150ms" }}
      />
      <div
        className={`${variantClass} eq h-3 w-1 rounded`}
        style={{ animationDelay: "300ms" }}
      />
    </div>
  );
}
