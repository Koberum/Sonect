import { LogServiceImpl, type LogService } from "./utils/logService.js";
import { TrackServiceImpl, type TrackService } from "./library/trackService.js";
import {
  ArtistServiceImpl,
  type ArtistService,
} from "./library/artistService.js";
import { AlbumServiceImpl, type AlbumService } from "./library/albumService.js";
import { GenreServiceImpl, type GenreService } from "./library/genreService.js";
import { MpdConnectionManager } from "./mpd/mpdConnectionManager.js";
import { AutoplayService } from "./mpd/autoplayService.js";
import {
  PlayerServiceImpl,
  type PlayerService,
} from "./player/playerService.js";
import { LibrarySyncService } from "./library/librarySyncService.js";
import { CoverServiceImpl, type CoverService } from "./library/coverService.js";
import {
  LibraryServiceImpl,
  type LibraryService,
} from "./library/libraryService.js";
import { ConfigServiceImpl, type ConfigService } from "./mpd/configService.js";
import {
  StorageServiceImpl,
  type StorageService,
} from "./storage/storageService.js";
import {
  SystemServiceImpl,
  type SystemServiceInterface,
} from "./system/systemService.js";
import { AudioServiceImpl, type AudioService } from "./mpd/audioService.js";
import { PlayTrackingService } from "./player/playTrackingService.js";
import { PlaylistService } from "./library/playlistService.js";

let _initialized = false;
let _logService: LogService;
let _trackService: TrackService;
let _artistService: ArtistService;
let _albumService: AlbumService;
let _genreService: GenreService;
let _mpdConnectionManager: MpdConnectionManager;
let _autoplayService: AutoplayService;
let _playerService: PlayerService;
let _librarySyncService: LibrarySyncService;
let _coverService: CoverService;
let _libraryService: LibraryService;
let _configService: ConfigService;
let _storageService: StorageService;
let _systemService: SystemServiceInterface;
let _audioService: AudioService;
let _playTrackingService: PlayTrackingService;
let _playlistService: PlaylistService;

function assertInitialized(): void {
  if (!_initialized) {
    throw new Error(
      "Services not initialized. Call initializeServices() first.",
    );
  }
}

export function initializeServices(): void {
  if (_initialized) return;

  _logService = new LogServiceImpl();
  _trackService = new TrackServiceImpl();
  _artistService = new ArtistServiceImpl();
  _albumService = new AlbumServiceImpl();
  _genreService = new GenreServiceImpl();
  _autoplayService = new AutoplayService();
  _configService = new ConfigServiceImpl();
  _audioService = new AudioServiceImpl();

  _mpdConnectionManager = new MpdConnectionManager(_trackService, _logService);

  _playerService = new PlayerServiceImpl(
    _logService,
    _mpdConnectionManager,
    _autoplayService,
  );

  _librarySyncService = new LibrarySyncService(_mpdConnectionManager);

  _coverService = new CoverServiceImpl(_logService);
  _libraryService = new LibraryServiceImpl(
    _playerService,
    _coverService,
    _librarySyncService,
  );

  _storageService = new StorageServiceImpl(
    _mpdConnectionManager,
    _libraryService,
    _configService,
    _logService,
  );

  _systemService = new SystemServiceImpl(_mpdConnectionManager);

  _playlistService = new PlaylistService(_mpdConnectionManager);

  _playTrackingService = new PlayTrackingService(_mpdConnectionManager);

  _mpdConnectionManager.setAutoplayCallback(async (currentFile: string) => {
    const sessionId = _autoplayService.sessionId;
    const queue = await _playerService.getQueue();
    if (_autoplayService.sessionId !== sessionId) return;

    const tracks = await _autoplayService.getNextBatch(currentFile, {
      queuedFiles: queue.map((t) => t.file),
    });
    if (tracks.length > 0 && _autoplayService.sessionId === sessionId) {
      await _playerService.queueFiles(tracks);
      _autoplayService.commitBatch(tracks, sessionId);
    }
  });

  _initialized = true;
}

export function getLogService(): LogService {
  assertInitialized();
  return _logService;
}

export function getTrackService(): TrackService {
  assertInitialized();
  return _trackService;
}

export function getArtistService(): ArtistService {
  assertInitialized();
  return _artistService;
}

export function getAlbumService(): AlbumService {
  assertInitialized();
  return _albumService;
}

export function getGenreService(): GenreService {
  assertInitialized();
  return _genreService;
}

export function getMpdConnectionManager(): MpdConnectionManager {
  assertInitialized();
  return _mpdConnectionManager;
}

export function getAutoplayService(): AutoplayService {
  assertInitialized();
  return _autoplayService;
}

export function getPlayerService(): PlayerService {
  assertInitialized();
  return _playerService;
}

export function getLibrarySyncService(): LibrarySyncService {
  assertInitialized();
  return _librarySyncService;
}

export function getCoverService(): CoverService {
  assertInitialized();
  return _coverService;
}

export function getLibraryService(): LibraryService {
  assertInitialized();
  return _libraryService;
}

export function getConfigService(): ConfigService {
  assertInitialized();
  return _configService;
}

export function getStorageService(): StorageService {
  assertInitialized();
  return _storageService;
}

export function getSystemService(): SystemServiceInterface {
  assertInitialized();
  return _systemService;
}

export function getAudioService(): AudioService {
  assertInitialized();
  return _audioService;
}

export function getPlayTrackingService(): PlayTrackingService {
  assertInitialized();
  return _playTrackingService;
}

export function getPlaylistService(): PlaylistService {
  assertInitialized();
  return _playlistService;
}

export function isServicesInitialized(): boolean {
  return _initialized;
}
