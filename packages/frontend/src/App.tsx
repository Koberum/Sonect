import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, useParams } from "react-router-dom";
import MainLayout from "./layout/MainLayout";
import { ThemeProvider } from "./components/theme-provider";
import { ErrorBoundary } from "./components/error-boundary";
import { PageSkeleton } from "./components/ui/page-skeleton";
import NotFound from "./pages/NotFound";
import { AuthProvider } from "./features/auth/auth-context";
import { AuthGuard } from "./features/auth/auth-guard";
import { AdminGuard } from "./features/auth/admin-guard";
import { PlaybackProvider } from "./components/playback-context";
import { WebSocketProvider } from "./components/ws-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { useMediaQuery } from "react-responsive";
import { queryClient } from "@/lib/queryClient";

const Devtools = lazy(() =>
  import("@tanstack/react-query-devtools").then((m) => ({
    default: m.ReactQueryDevtools,
  })),
);

const LoginPage = lazy(() =>
  import("./features/auth/login-page").then((m) => ({
    default: m.LoginPage,
  })),
);

const DiscoverSection = lazy(() =>
  import("./layout/DiscoverSection").then((m) => ({
    default: m.DiscoverSection,
  })),
);
const LibrarySection = lazy(() =>
  import("./layout/LibrarySection").then((m) => ({
    default: m.LibrarySection,
  })),
);
const PlayerPage = lazy(() => import("./pages/PlayerPage"));
const QueuePage = lazy(() => import("./pages/QueuePage"));
const PlaylistsPage = lazy(() => import("./pages/Playlists"));
const PlaylistDetail = lazy(() => import("./pages/PlaylistDetail"));
const AlbumPage = lazy(() => import("./pages/AlbumTracks"));
const ArtistAlbums = lazy(() =>
  import("./pages/ArtistAlbums").then((m) => ({ default: m.ArtistAlbums })),
);
const GenreDetail = lazy(() => import("./pages/GenreDetail"));
const Settings = lazy(() => import("./pages/Settings"));
const SetupWizard = lazy(() => import("./pages/SetupWizard"));

type LegacyTabRedirectProps = { to: string; tab: string };

const LEGACY_TAB_REDIRECTS: (LegacyTabRedirectProps & { path: string })[] = [
  { path: "home/listen", to: "/discover", tab: "listen" },
  { path: "home/liked", to: "/discover", tab: "liked" },
  { path: "library/albums", to: "/library", tab: "albums" },
  { path: "library/artists", to: "/library", tab: "artists" },
  { path: "library/genres", to: "/library", tab: "genres" },
  { path: "library/statistics", to: "/library", tab: "statistics" },
  { path: "settings/audio", to: "/settings", tab: "audio" },
  { path: "settings/playback", to: "/settings", tab: "playback" },
  { path: "settings/libraries", to: "/settings", tab: "libraries" },
  { path: "settings/appearance", to: "/settings", tab: "appearance" },
  { path: "settings/debug", to: "/settings", tab: "debug" },
];

function LegacyTabRedirect({ to, tab }: LegacyTabRedirectProps) {
  return <Navigate to={to} state={{ tab }} replace />;
}

function LegacyPlaylistRedirect() {
  const { id } = useParams();
  return <Navigate to={id ? `/playlists/${id}` : "/playlists"} replace />;
}

export default function App() {
  const isDesktop = useMediaQuery({ minWidth: 768 });

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <AuthProvider>
          <PlaybackProvider>
            <WebSocketProvider>
              <TooltipProvider>
                <ErrorBoundary>
                  <Suspense fallback={<PageSkeleton />}>
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
                          element={<Navigate to="/discover" replace />}
                        />
                        <Route path="player" element={<PlayerPage />} />
                        <Route path="queue" element={<QueuePage />} />

                        <Route path="discover" element={<DiscoverSection />} />

                        <Route path="playlists" element={<PlaylistsPage />} />
                        <Route
                          path="playlists/:id"
                          element={<PlaylistDetail />}
                        />

                        <Route path="library" element={<LibrarySection />}>
                          <Route path="albums/:id" element={<AlbumPage />} />
                          <Route
                            path="artists/:artistId"
                            element={<ArtistAlbums />}
                          />
                          <Route
                            path="genres/:genre"
                            element={<GenreDetail />}
                          />
                        </Route>

                        <Route
                          path="settings"
                          element={
                            <AdminGuard>
                              <Settings />
                            </AdminGuard>
                          }
                        />

                        {/* Legacy tab URLs: tabs are in-page state now. */}
                        <Route
                          path="home"
                          element={<Navigate to="/discover" replace />}
                        />
                        <Route
                          path="home/playlists"
                          element={<Navigate to="/playlists" replace />}
                        />
                        <Route
                          path="home/playlists/:id"
                          element={<LegacyPlaylistRedirect />}
                        />
                        {LEGACY_TAB_REDIRECTS.map(({ path, to, tab }) => (
                          <Route
                            key={path}
                            path={path}
                            element={<LegacyTabRedirect to={to} tab={tab} />}
                          />
                        ))}
                        <Route path="*" element={<NotFound />} />
                      </Route>
                    </Routes>
                  </Suspense>
                </ErrorBoundary>
              </TooltipProvider>
            </WebSocketProvider>
          </PlaybackProvider>
        </AuthProvider>
      </ThemeProvider>
      {import.meta.env.DEV && isDesktop && (
        <Suspense fallback={null}>
          <Devtools initialIsOpen={false} buttonPosition="bottom-left" />
        </Suspense>
      )}
    </QueryClientProvider>
  );
}
