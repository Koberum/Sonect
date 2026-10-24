import { expect } from "chai";
import sinon from "sinon";
import { createTestDb } from "@tests/helpers/db.js";
import { album } from "@tests/factories/index.js";
import { albumsDb } from "@repo/db";
import type { Album } from "@repo/types/catalog";
import { CoverSyncServiceImpl } from "@services/library/coverSyncService.js";
import type { LogService } from "@services/utils/logService";

describe("cover sync", () => {
  let close: () => void;
  let sandbox: sinon.SinonSandbox;
  let logService: LogService;

  beforeEach(() => {
    ({ close } = createTestDb());
    sandbox = sinon.createSandbox();
    logService = { pushLog: sandbox.stub() } as unknown as LogService;
  });

  afterEach(() => {
    sandbox.restore();
    close();
  });

  it("processes albums with bounded concurrency", async () => {
    for (let index = 0; index < 5; index += 1) {
      album.create({
        title: `Cover Album ${index}`,
        artistName: "Cover Artist",
      });
    }
    const albums = albumsDb.getAll();
    expect(albums).to.have.length(5);

    const service = new CoverSyncServiceImpl(logService, 2);
    const seam = service as unknown as {
      findAndSaveCover: (item: Album) => Promise<string | null>;
      ensureCoversDir: () => void;
    };
    sandbox.stub(seam, "ensureCoversDir");
    const active = { now: 0, max: 0 };
    sandbox.stub(seam, "findAndSaveCover").callsFake(async () => {
      active.now += 1;
      active.max = Math.max(active.max, active.now);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active.now -= 1;
      return null;
    });

    const progress: number[] = [];
    await service.syncAllCovers(albums, (item) => progress.push(item.current));

    expect(active.max).to.equal(2);
    expect(progress.length).to.be.greaterThan(0);
    expect(progress.length).to.be.lessThan(albums.length);
    expect(progress[progress.length - 1]).to.equal(albums.length);
  });
});
