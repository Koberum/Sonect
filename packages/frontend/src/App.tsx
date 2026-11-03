import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, useParams } from "react-router-dom";
import MainLayout from "./layout/MainLayout";
import { ThemeProvider } from "./components/theme-provider";
import { AuthProvider } from "./features/auth/auth-context";
import { AuthGuard } from "./features/auth/auth-guard";
import { AdminGuard } from "./features/auth/admin-guard";
import { LoginPage } from "./features/auth/login-page";
import { PlaybackProvider } from "./components/playback-context";
import { WebSocketProvider } from "./components/ws-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";

const Devtools = lazy(() =>
  import("@tanstack/react-query-devtools").then((m) => ({
    default: m.ReactQueryDevtools,
  })),
);

const HomeSection = lazy(() =>
  import("./layout/HomeSection").then((m) => ({ default: m.HomeSection })),
);
const LibrarySection = lazy(() =>
  import("./layout/LibrarySection").then((m) => ({
    default: m.LibrarySection,
  })),
);
const Dashboard = lazy(() => import("./pages/Dashboard"));
const AlbumPage = lazy(() => import("./pages/AlbumTracks"));
const Albums = lazy(() => import("./pages/Albums"));
const LikedSongs = lazy(() => import("./pages/LikedSongs"));
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
const Playlists = lazy(() => import("./pages/Playlists"));
const PlaylistDetail = lazy(() => import("./pages/PlaylistDetail"));
const Settings = lazy(() =>
  import("./pages/Settings").then((m) => ({ default: m.Settings })),
);
const AudioTab = lazy(() =>
  import("./features/settings/audio-tab").then((m) => ({
    default: m.AudioTab,
  })),
);
const PlaybackTab = lazy(() =>
  import("./features/settings/playback-tab").then((m) => ({
    default: m.PlaybackTab,
  })),
);
const LibrariesTab = lazy(() =>
  import("./features/settings/libraries-tab").then((m) => ({
    default: m.LibrariesTab,
  })),
);
const AppearanceTab = lazy(() =>
  import("./features/settings/appearance-tab").then((m) => ({
    default: m.AppearanceTab,
  })),
);
const DebugTab = lazy(() =>
  import("./features/settings/debug-tab").then((m) => ({
    default: m.DebugTab,
  })),
);
const SetupWizard = lazy(() => import("./pages/SetupWizard"));

function PageLoader() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2" />
    </div>
  );
}

function LegacyRedirect({ base }: { base: string }) {
  const rest = useParams()["*"];
  return <Navigate to={rest ? `${base}/${rest}` : base} replace />;
}

function LegacyArtistAlbums() {
  const { artistId } = useParams();
  return <Navigate to={`/library/artists/${artistId}`} replace />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <AuthProvider>
          <PlaybackProvider>
            <WebSocketProvider>
              <TooltipProvider>
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route
                      path="/login"
                      element={
                        <AuthGuard>
                          <LoginPage />
                        </AuthGuard>
                      }
                    />
                    <Route
                      path="/setup"
                      element={
                        <AuthGuard>
                          <SetupWizard />
                        </AuthGuard>
                      }
                    />
                    <Route
                      path="/"
                      element={
                        <AuthGuard>
                          <MainLayout />
                        </AuthGuard>
                      }
                    >
                      <Route
                        index
                        element={<Navigate to="/home/listen" replace />}
                      />

                      <Route path="home" element={<HomeSection />}>
                        <Route
                          index
                          element={<Navigate to="listen" replace />}
                        />
                        <Route path="listen" element={<Dashboard />} />
                        <Route path="playlists" element={<Playlists />} />
                        <Route
                          path="playlists/:id"
                          element={<PlaylistDetail />}
                        />
                        <Route path="liked" element={<LikedSongs />} />
                      </Route>

                      <Route path="library" element={<LibrarySection />}>
                        <Route
                          index
                          element={<Navigate to="albums" replace />}
                        />
                        <Route path="albums" element={<Albums />} />
                        <Route path="albums/:id" element={<AlbumPage />} />
                        <Route path="artists" element={<Artists />} />
                        <Route
                          path="artists/:artistId"
                          element={<ArtistAlbums />}
                        />
                        <Route path="genres" element={<Genres />} />
                        <Route path="genres/:genre" element={<GenreDetail />} />
                        <Route path="statistics" element={<Statistics />} />
                      </Route>

                      <Route
                        path="settings"
                        element={
                          <AdminGuard>
                            <Settings />
                          </AdminGuard>
                        }
                      >
                        <Route
                          index
                          element={<Navigate to="audio" replace />}
                        />
                        <Route path="audio" element={<AudioTab />} />
                        <Route path="playback" element={<PlaybackTab />} />
                        <Route path="libraries" element={<LibrariesTab />} />
                        <Route path="appearance" element={<AppearanceTab />} />
                        <Route path="debug" element={<DebugTab />} />
                      </Route>

                      {/* Legacy URLs kept as redirects so old bookmarks work. */}
                      <Route
                        path="albums/*"
                        element={<LegacyRedirect base="/library/albums" />}
                      />
                      <Route
                        path="artists/:artistId/albums"
                        element={<LegacyArtistAlbums />}
                      />
                      <Route
                        path="artists/*"
                        element={<LegacyRedirect base="/library/artists" />}
                      />
                      <Route
                        path="genres/*"
                        element={<LegacyRedirect base="/library/genres" />}
                      />
                      <Route
                        path="playlists/*"
                        element={<LegacyRedirect base="/home/playlists" />}
                      />
                      <Route
                        path="liked"
                        element={<Navigate to="/home/liked" replace />}
                      />
                      <Route
                        path="tracks"
                        element={<Navigate to="/home/liked" replace />}
                      />
                      <Route
                        path="library/stats"
                        element={<Navigate to="/library/statistics" replace />}
                      />
                    </Route>
                  </Routes>
                </Suspense>
              </TooltipProvider>
            </WebSocketProvider>
          </PlaybackProvider>
        </AuthProvider>
      </ThemeProvider>
      {import.meta.env.DEV && (
        <Suspense fallback={null}>
          <Devtools initialIsOpen={false} buttonPosition="top-left" />
        </Suspense>
      )}
    </QueryClientProvider>
  );
}
