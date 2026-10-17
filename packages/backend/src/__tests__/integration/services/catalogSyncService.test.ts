import { expect } from "chai";
import sinon from "sinon";
import { WebSocket, type WebSocketServer } from "ws";
import { createTestDb } from "@tests/helpers/db.js";
import {
  CatalogSyncService,
  type ScanResult,
} from "@services/library/catalogSyncService.js";
import { CatalogSyncOrchestratorImpl } from "@services/library/catalogSyncOrchestrator.js";
import type { LibraryScanner } from "@services/library/libraryScanner.js";
import type { CoverSyncService } from "@services/library/coverSyncService.js";
import type { LogService } from "@services/utils/logService.js";
import { setWss } from "../../../ws/broadcast.js";

type ProgressMessage = {
  type: string;
  phase?: string;
  current?: number;
  total?: number;
};

function captureBroadcasts(sandbox: sinon.SinonSandbox): ProgressMessage[] {
  void sandbox;
  const messages: ProgressMessage[] = [];
  const clients = new Set([
    {
      readyState: WebSocket.OPEN,
      send: (raw: string) => messages.push(JSON.parse(raw)),
    },
  ]);
  setWss({ clients } as unknown as WebSocketServer);
  return messages;
}

describe("CatalogSyncService (integration)", () => {
  let close: () => void;
  let sandbox: sinon.SinonSandbox;
  let logService: LogService;

  beforeEach(() => {
    ({ close } = createTestDb());
    sandbox = sinon.createSandbox();
    logService = { pushLog: sandbox.stub() } as unknown as LogService;
  });

  afterEach(() => {
    setWss({ clients: new Set() } as unknown as WebSocketServer);
    sandbox.restore();
    close();
  });

  describe("scanAll", () => {
    it("delegates to the injected scanner and returns its result", async () => {
      const result: ScanResult = { synced: 3, deleted: 1, errors: 0 };
      const scan = sandbox.stub().resolves(result);
      const scanner = { scan } as unknown as LibraryScanner;
      const service = new CatalogSyncService(scanner, logService);

      const onProgress = sandbox.stub();
      const returned = await service.scanAll(onProgress);

      expect(scan.calledOnce).to.equal(true);
      expect(scan.firstCall.args[0]).to.equal(onProgress);
      expect(returned).to.deep.equal(result);
    });
  });

  describe("CatalogSyncOrchestrator.scanLibrary", () => {
    it("runs the scanner via the service and broadcasts progress + complete", async () => {
      const messages = captureBroadcasts(sandbox);
      const scan = sandbox
        .stub()
        .callsFake(
          async (
            onProgress?: (p: {
              phase: "tracks";
              current: number;
              total: number;
            }) => void,
          ) => {
            onProgress?.({ phase: "tracks", current: 1, total: 2 });
            onProgress?.({ phase: "tracks", current: 2, total: 2 });
            return { synced: 2, deleted: 0, errors: 0 };
          },
        );
      const scanner = { scan } as unknown as LibraryScanner;
      const service = new CatalogSyncService(scanner, logService);
      const coverSyncService = {
        syncAllCovers: sandbox.stub().resolves(),
      } as unknown as CoverSyncService;

      const orchestrator = new CatalogSyncOrchestratorImpl(
        coverSyncService,
        service,
      );

      await orchestrator.scanLibrary();

      expect(scan.calledOnce).to.equal(true);
      const progress = messages.filter((m) => m.type === "sync-progress");
      expect(
        progress.some((m) => m.phase === "tracks" && m.current === 2),
      ).to.equal(true);
      expect(messages.some((m) => m.type === "sync-complete")).to.equal(true);
    });
  });
});
