import { expect } from "chai";
import sinon from "sinon";
import { WebSocket, type WebSocketServer } from "ws";
import { createTestDb } from "@tests/helpers/db.js";
import { album } from "@tests/factories/index.js";
import { CatalogSyncOrchestratorImpl } from "@services/library/catalogSyncOrchestrator.js";
import type {
  CatalogSyncResult,
  CatalogSyncService,
} from "@services/library/mpdCatalogSyncService.js";
import type { CoverSyncService } from "@services/library/coverSyncService.js";
import type { LibraryStatsService } from "@services/storage/libraryStatsService.js";
import { setWss } from "../../../ws/broadcast.js";

type BroadcastMessage = {
  type: string;
  phase?: string;
  current?: number;
  total?: number;
  message?: string;
};

const EMPTY_RESULT: CatalogSyncResult = {
  synced: 1,
  deleted: 0,
  errors: 0,
  changedSourceIds: [7],
  skipped: false,
};

function captureBroadcasts(): BroadcastMessage[] {
  const messages: BroadcastMessage[] = [];
  const clients = new Set([
    {
      readyState: WebSocket.OPEN,
      send: (raw: string) => messages.push(JSON.parse(raw)),
    },
  ]);
  setWss({ clients } as unknown as WebSocketServer);
  return messages;
}

describe("CatalogSyncOrchestrator", () => {
  let close: () => void;
  let sandbox: sinon.SinonSandbox;
  let messages: BroadcastMessage[];

  beforeEach(() => {
    ({ close } = createTestDb());
    sandbox = sinon.createSandbox();
    messages = captureBroadcasts();
  });

  afterEach(() => {
    setWss({ clients: new Set() } as unknown as WebSocketServer);
    sandbox.restore();
    close();
  });

  function makeOrchestrator(options: {
    sync?: sinon.SinonStub;
    covers?: sinon.SinonStub;
    stats?: sinon.SinonStub;
  }) {
    const sync =
      options.sync ??
      sandbox
        .stub()
        .callsFake(
          async (
            _options: unknown,
            onProgress?: (progress: {
              phase: string;
              current: number;
              total: number;
              track: { title: string; artist: string; album: string } | null;
            }) => void,
          ) => {
            onProgress?.({
              phase: "mpd",
              current: 0,
              total: 0,
              track: null,
            });
            onProgress?.({
              phase: "tracks",
              current: 1,
              total: 1,
              track: { title: "T", artist: "A", album: "B" },
            });
            return EMPTY_RESULT;
          },
        );
    const covers =
      options.covers ??
      sandbox
        .stub()
        .callsFake(
          async (
            albums: { id: number; title: string; artist_name: string }[],
            onProgress?: (progress: {
              current: number;
              total: number;
              album: { id: number; title: string; artist: string };
            }) => void,
          ) => {
            onProgress?.({
              current: albums.length,
              total: albums.length,
              album: {
                id: albums[0].id,
                title: albums[0].title,
                artist: albums[0].artist_name,
              },
            });
          },
        );
    const stats = options.stats ?? sandbox.stub().resolves();

    const orchestrator = new CatalogSyncOrchestratorImpl(
      { syncAllCovers: covers } as unknown as CoverSyncService,
      { sync } as unknown as CatalogSyncService,
      {
        refresh: stats,
        refreshOne: sandbox.stub(),
      } as unknown as LibraryStatsService,
    );
    return { orchestrator, sync, covers, stats };
  }

  it("broadcasts scan-started, mpd/tracks/covers progress, then sync-complete", async () => {
    album.create({ title: "Cover Album", artistName: "Cover Artist" });
    const { orchestrator, stats } = makeOrchestrator({});

    await orchestrator.scanLibrary({ force: true });

    const progress = messages.filter((m) => m.type === "sync-progress");
    expect(progress[0].phase).to.equal("scan-started");
    expect(progress.some((m) => m.phase === "mpd")).to.equal(true);
    expect(progress.some((m) => m.phase === "tracks")).to.equal(true);
    expect(progress.some((m) => m.phase === "covers")).to.equal(true);
    expect(messages.some((m) => m.type === "sync-complete")).to.equal(true);
    expect(stats.firstCall.args[0]).to.deep.equal([7]);
  });

  it("does not run covers when there are no albums", async () => {
    const { orchestrator, covers, stats } = makeOrchestrator({});

    await orchestrator.scanLibrary({ force: false });

    expect(covers.called).to.equal(false);
    expect(stats.calledOnce).to.equal(true);
  });

  it("broadcasts sync-error and rethrows when the catalog sync fails", async () => {
    const sync = sandbox.stub().rejects(new Error("boom"));
    const { orchestrator } = makeOrchestrator({ sync });

    let error: unknown;
    try {
      await orchestrator.scanLibrary();
    } catch (err) {
      error = err;
    }

    expect(error).to.be.instanceOf(Error);
    expect(
      messages.some((m) => m.type === "sync-error" && m.message === "boom"),
    ).to.equal(true);
  });

  it("ignores a second scan while one is running", async () => {
    let resolveSync!: (result: CatalogSyncResult) => void;
    const sync = sandbox.stub().returns(
      new Promise<CatalogSyncResult>((resolve) => {
        resolveSync = resolve;
      }),
    );
    const { orchestrator } = makeOrchestrator({ sync });

    const first = orchestrator.scanLibrary();
    const second = orchestrator.scanLibrary();
    expect(sync.calledOnce).to.equal(true);

    resolveSync(EMPTY_RESULT);
    await Promise.all([first, second]);
  });
});
