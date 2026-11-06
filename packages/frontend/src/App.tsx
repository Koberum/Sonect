import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
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
import { useMediaQuery } from "react-responsive";
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
const PlayerPage = lazy(() => import("./pages/PlayerPage"));
const PlaylistDetail = lazy(() => import("./pages/PlaylistDetail"));
const AlbumPage = lazy(() => import("./pages/AlbumTracks"));
const ArtistAlbums = lazy(() =>
  import("./pages/ArtistAlbums").then((m) => ({ default: m.ArtistAlbums })),
);
const GenreDetail = lazy(() => import("./pages/GenreDetail"));
const Settings = lazy(() => import("./pages/Settings"));
const SetupWizard = lazy(() => import("./pages/SetupWizard"));

function PageLoader() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2" />
    </div>
  );
}

type LegacyTabRedirectProps = { to: string; tab: string };

function LegacyTabRedirect({ to, tab }: LegacyTabRedirectProps) {
  return <Navigate to={to} state={{ tab }} replace />;
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
                      <Route index element={<Navigate to="/home" replace />} />
                      <Route path="player" element={<PlayerPage />} />

                      <Route path="home" element={<HomeSection />}>
                        <Route
                          path="playlists/:id"
                          element={<PlaylistDetail />}
                        />
                      </Route>

                      <Route path="library" element={<LibrarySection />}>
                        <Route path="albums/:id" element={<AlbumPage />} />
                        <Route
                          path="artists/:artistId"
                          element={<ArtistAlbums />}
                        />
                        <Route path="genres/:genre" element={<GenreDetail />} />
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
                        path="home/listen"
                        element={<LegacyTabRedirect to="/home" tab="listen" />}
                      />
                      <Route
                        path="home/playlists"
                        element={
                          <LegacyTabRedirect to="/home" tab="playlists" />
                        }
                      />
                      <Route
                        path="home/liked"
                        element={<LegacyTabRedirect to="/home" tab="liked" />}
                      />
                      <Route
                        path="library/albums"
                        element={
                          <LegacyTabRedirect to="/library" tab="albums" />
                        }
                      />
                      <Route
                        path="library/artists"
                        element={
                          <LegacyTabRedirect to="/library" tab="artists" />
                        }
                      />
                      <Route
                        path="library/genres"
                        element={
                          <LegacyTabRedirect to="/library" tab="genres" />
                        }
                      />
                      <Route
                        path="library/statistics"
                        element={
                          <LegacyTabRedirect to="/library" tab="statistics" />
                        }
                      />
                      <Route
                        path="settings/audio"
                        element={
                          <LegacyTabRedirect to="/settings" tab="audio" />
                        }
                      />
                      <Route
                        path="settings/playback"
                        element={
                          <LegacyTabRedirect to="/settings" tab="playback" />
                        }
                      />
                      <Route
                        path="settings/libraries"
                        element={
                          <LegacyTabRedirect to="/settings" tab="libraries" />
                        }
                      />
                      <Route
                        path="settings/appearance"
                        element={
                          <LegacyTabRedirect to="/settings" tab="appearance" />
                        }
                      />
                      <Route
                        path="settings/debug"
                        element={
                          <LegacyTabRedirect to="/settings" tab="debug" />
                        }
                      />
                    </Route>
                  </Routes>
                </Suspense>
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
