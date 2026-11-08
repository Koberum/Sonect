import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { catalogQueries } from "@/features/catalog/queries";
import { useNavigate } from "react-router-dom";
import { EmptyState } from "@/components/ui/empty-state";
import { MediaGrid } from "@/features/catalog/components/media-grid";
import { Skeleton } from "@/components/ui/skeleton";
import {
  SelectableRow,
  SelectableRowDescription,
  SelectableRowIcon,
  SelectableRowTitle,
} from "@/components/ui/selectable-row";
import { Music, Disc3 } from "lucide-react";

export default function Genres() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: genres = [], isPending } = useQuery(catalogQueries.genres());

  return (
    <div>
      {isPending ? (
        <MediaGrid className="grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </MediaGrid>
      ) : (
        <>
          {genres.length === 0 && (
            <EmptyState icon={Music} title={t("genres.noGenres")} />
          )}
          <MediaGrid className="grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4">
            {genres.map((g) => (
              <SelectableRow
                key={g.id}
                asChild
                className="bg-card gap-4 rounded-xl p-4 shadow-sm"
                onClick={() =>
                  navigate(`/library/genres/${encodeURIComponent(g.name)}`)
                }
              >
                <div>
                  <SelectableRowIcon className="bg-primary/10 [&_svg]:text-primary h-12 w-12 rounded-full">
                    <Music className="h-6 w-6" />
                  </SelectableRowIcon>
                  <div className="min-w-0 flex-1">
                    <SelectableRowTitle className="truncate">
                      {g.name}
                    </SelectableRowTitle>
                    <SelectableRowDescription className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Disc3 className="size-4" />
                        {t("genres.albumCount", { count: g.album_count })}
                      </span>
                      <span>
                        {t("genres.trackCount", { count: g.track_count })}
                      </span>
                    </SelectableRowDescription>
                  </div>
                </div>
              </SelectableRow>
            ))}
          </MediaGrid>
        </>
      )}
    </div>
  );
}
