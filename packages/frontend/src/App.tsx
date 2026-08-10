import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import MainLayout from "./layout/MainLayout";
import { ThemeProvider } from "./components/theme-provider";
import { PlaybackProvider } from "./components/playback-context";
import { WebSocketProvider } from "./components/ws-provider";
import { PlaylistProvider } from "./components/playlist-context";
import { TooltipProvider } from "@/components/ui/tooltip";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const AlbumPage = lazy(() => import("./pages/AlbumTracks"));
const Albums = lazy(() => import("./pages/Albums"));
const Tracks = lazy(() => import("./pages/Tracks"));
const Genres = lazy(() => import("./pages/Genres"));
const GenreDetail = lazy(() => import("./pages/GenreDetail"));
const Artists = lazy(() =>
  import("./pages/Artists").then((m) => ({ default: m.Artists })),
);
const ArtistAlbums = lazy(() =>
  import("./pages/ArtistAlbums").then((m) => ({ default: m.ArtistAlbums })),
);
const Statistics = lazy(() =>
  import("./pages/Statistics").then((m) => ({ default: m.Statistics })),
);
const PlaylistDetail = lazy(() => import("./pages/PlaylistDetail"));
const SetupWizard = lazy(() => import("./pages/SetupWizard"));

function PageLoader() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2" />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <PlaybackProvider>
        <WebSocketProvider>
          <PlaylistProvider>
            <TooltipProvider>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/setup" element={<SetupWizard />} />
                  <Route path="/" element={<MainLayout />}>
                    <Route index element={<Dashboard />} />
                    <Route path="albums" element={<Albums />} />
                    <Route path="albums/:id" element={<AlbumPage />} />
                    <Route path="tracks" element={<Tracks />} />
                    <Route path="genres" element={<Genres />} />
                    <Route path="genres/:genre" element={<GenreDetail />} />
                    <Route path="artists" element={<Artists />} />
                    <Route
                      path="artists/:artistId/albums"
                      element={<ArtistAlbums />}
                    />
                    <Route path="library/stats" element={<Statistics />} />
                    <Route path="playlists/:id" element={<PlaylistDetail />} />
                  </Route>
                </Routes>
              </Suspense>
            </TooltipProvider>
          </PlaylistProvider>
        </WebSocketProvider>
      </PlaybackProvider>
    </ThemeProvider>
  );
}
