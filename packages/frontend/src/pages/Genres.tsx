import { useTranslation } from "react-i18next";
import { getGenres } from "@/features/apis/libraryApis";
import { usePlaybackContext } from "@/components/playback-context";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageTitle } from "@/features/dashboard/components/pageTitle";
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
  usePlaybackContext();
  const [genres, setGenres] = useState<
    { genre: string; track_count: number; album_count: number }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getGenres()
      .then(setGenres)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageTitle
        title={t("genres.title")}
        description={t("genres.description")}
      />
      {loading && genres.length === 0 ? (
        <div className="flex justify-center py-16">
          <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2" />
        </div>
      ) : (
        <>
          {genres.length === 0 && (
            <p className="text-muted-foreground mt-8 text-center">
              {t("genres.noGenres")}
            </p>
          )}
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {genres.map((g) => (
              <SelectableRow
                key={g.genre}
                asChild
                className="bg-card gap-4 rounded-xl p-4 py-6 shadow-sm"
                onClick={() =>
                  navigate(`/genres/${encodeURIComponent(g.genre)}`)
                }
              >
                <div>
                  <SelectableRowIcon className="bg-primary/10 [&_svg]:text-primary h-12 w-12 rounded-full">
                    <Music className="h-6 w-6" />
                  </SelectableRowIcon>
                  <div className="min-w-0 flex-1">
                    <SelectableRowTitle className="truncate">
                      {g.genre}
                    </SelectableRowTitle>
                    <SelectableRowDescription className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Disc3 className="h-3 w-3" />
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
          </div>
        </>
      )}
    </div>
  );
}
