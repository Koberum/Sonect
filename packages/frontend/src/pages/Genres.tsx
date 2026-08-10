import { useTranslation } from "react-i18next";
import { getGenres } from "@/features/apis/libraryApis";
import { usePlaybackContext } from "@/components/playback-context";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageTitle } from "@/features/dashboard/components/pageTitle";
import { Card, CardContent } from "@/components/ui/card";
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
              <Card
                key={g.genre}
                className="hover:bg-accent cursor-pointer transition-colors"
                onClick={() =>
                  navigate(`/genres/${encodeURIComponent(g.genre)}`)
                }
              >
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="bg-primary/10 flex h-12 w-12 items-center justify-center rounded-full">
                    <Music className="text-primary h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{g.genre}</p>
                    <p className="text-muted-foreground flex items-center gap-3 text-sm">
                      <span className="flex items-center gap-1">
                        <Disc3 className="h-3 w-3" />
                        {t("genres.albumCount", { count: g.album_count })}
                      </span>
                      <span>
                        {t("genres.trackCount", { count: g.track_count })}
                      </span>
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
