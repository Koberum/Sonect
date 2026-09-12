import { LogServiceImpl, type LogService } from "./utils/logService.js";
import {
  CatalogServiceImpl,
  type CatalogService,
} from "./library/catalogService.js";
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
import {
  MpdConfigServiceImpl,
  type MpdConfigService,
} from "./mpd/mpdConfigService.js";
import {
  StorageServiceImpl,
  type StorageService,
} from "./storage/storageService.js";
import {
  SystemServiceImpl,
  type SystemServiceInterface,
} from "./system/systemService.js";
import { PlayTrackingService } from "./player/playTrackingService.js";
import {
  PlaylistService,
  PlaylistServiceImpl,
} from "./library/playlistService.js";
import {
  SuggestionService,
  type SuggestionServiceInterface,
} from "./library/suggestionService.js";
import { SetupServiceImpl, type SetupService } from "./system/setupService.js";
import {
  NetworkServiceImpl,
  type NetworkService,
} from "./network/networkService.js";

let _initialized = false;
let _logService: LogService;
let _catalogService: CatalogService;
let _mpdConnectionManager: MpdConnectionManager;
let _autoplayService: AutoplayService;
let _playerService: PlayerService;
let _librarySyncService: LibrarySyncService;
let _coverService: CoverService;
let _libraryService: LibraryService;
let _mpdConfigService: MpdConfigService;
let _storageService: StorageService;
let _systemService: SystemServiceInterface;
let _playTrackingService: PlayTrackingService;
let _playlistService: PlaylistService;
let _suggestionService: SuggestionServiceInterface;
let _setupService: SetupService;
let _networkService: NetworkService;

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
  _catalogService = new CatalogServiceImpl();
  _autoplayService = new AutoplayService();
  _mpdConfigService = new MpdConfigServiceImpl();

  _mpdConnectionManager = new MpdConnectionManager(
    _catalogService,
    _logService,
  );

  _playerService = new PlayerServiceImpl(
    _logService,
    _mpdConnectionManager,
    _autoplayService,
  );

  _librarySyncService = new LibrarySyncService(
    _mpdConnectionManager,
    _logService,
  );

  _coverService = new CoverServiceImpl(_logService);
  _libraryService = new LibraryServiceImpl(_coverService, _librarySyncService);

  _storageService = new StorageServiceImpl(
    _mpdConnectionManager,
    _libraryService,
    _mpdConfigService,
    _logService,
  );

  _systemService = new SystemServiceImpl(_mpdConnectionManager);

  _playlistService = new PlaylistServiceImpl(_mpdConnectionManager);

  _playTrackingService = new PlayTrackingService(_mpdConnectionManager);

  _suggestionService = new SuggestionService();
  _setupService = new SetupServiceImpl();
  _networkService = new NetworkServiceImpl();

  _mpdConnectionManager.setAutoplayCallback(async (currentFile: string) => {
    const sessionId = _autoplayService.sessionId;
    const queue = await _playerService.getQueue();
    if (_autoplayService.sessionId !== sessionId) return;

    const tracks = _autoplayService.getNextBatch(currentFile, {
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

export function getCatalogService(): CatalogService {
  assertInitialized();
  return _catalogService;
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

export function getMpdConfigService(): MpdConfigService {
  assertInitialized();
  return _mpdConfigService;
}

export function getStorageService(): StorageService {
  assertInitialized();
  return _storageService;
}

export function getSystemService(): SystemServiceInterface {
  assertInitialized();
  return _systemService;
}

export function getPlayTrackingService(): PlayTrackingService {
  assertInitialized();
  return _playTrackingService;
}

export function getPlaylistService(): PlaylistService {
  assertInitialized();
  return _playlistService;
}

export function getSuggestionService(): SuggestionServiceInterface {
  assertInitialized();
  return _suggestionService;
}

export function getSetupService(): SetupService {
  assertInitialized();
  return _setupService;
}

export function getNetworkService(): NetworkService {
  assertInitialized();
  return _networkService;
}

export function isServicesInitialized(): boolean {
  return _initialized;
}
