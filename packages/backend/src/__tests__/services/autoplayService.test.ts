import { expect } from "chai";
import sinon from "sinon";
import esmock from "esmock";

describe("Autoplay Service", () => {
  let autoplayService: any;
  let getRankedByPlayCount: sinon.SinonStub;
  let getByAlbumOrdered: sinon.SinonStub;

  beforeEach(async () => {
    const rankedAlbums = [
      { id: 2, title: "Artist album", artist_id: 1, genre: "Jazz" },
      { id: 3, title: "Genre album", artist_id: 2, genre: "Rock" },
      { id: 4, title: "Global album", artist_id: 3, genre: "Pop" },
    ];
    getRankedByPlayCount = sinon.stub().callsFake(
      ({
        artistId,
        genre,
        excludeIds = [],
      }: {
        artistId?: number;
        genre?: string;
        excludeIds?: number[];
      } = {}) =>
        rankedAlbums.filter(
          (album) =>
            (artistId === undefined || album.artist_id === artistId) &&
            (genre === undefined || album.genre === genre) &&
            !excludeIds.includes(album.id),
        ),
    );

    getByAlbumOrdered = sinon.stub().callsFake((albumId: number) => {
      const tracks: Record<number, { file: string }[]> = {
        1: [
          { file: "current/a.mp3" },
          { file: "current/b.mp3" },
          { file: "current/c.mp3" },
          { file: "current/d.mp3" },
        ],
        2: [{ file: "artist/one.mp3" }],
        3: [{ file: "genre/one.mp3" }],
        4: [{ file: "global/one.mp3" }],
      };
      return tracks[albumId] ?? [];
    });

    const module = await esmock("../../services/autoplayService.ts", {
      "@repo/db": {
        tracksDb: {
          getByFile: sinon.stub().callsFake((file: string) => {
            if (file.startsWith("current/")) {
              return {
                file,
                album_id: 1,
                artist_id: 1,
                genre: "Rock",
              };
            }
            if (file.startsWith("artist/")) return { file, album_id: 2 };
            if (file.startsWith("genre/")) return { file, album_id: 3 };
            if (file.startsWith("global/")) return { file, album_id: 4 };
            return undefined;
          }),
          getByAlbumOrdered,
          getRandomTracks: sinon.stub().returns([{ file: "global/one.mp3" }]),
        },
        albumsDb: {
          getById: sinon.stub().returns({ id: 1, genre: "Rock" }),
          getByArtist: sinon
            .stub()
            .returns([{ id: 2, title: "Artist album", artist_id: 1 }]),
          getByGenre: sinon
            .stub()
            .returns([{ id: 3, title: "Genre album", artist_id: 2 }]),
          getRankedByPlayCount,
        },
      },
    });
    autoplayService = module.autoplayService;
  });

  afterEach(() => {
    sinon.restore();
  });

  it("queues ranked artist, genre, and global albums without the current album", async () => {
    const files = await autoplayService.getNextBatch("current/c.mp3");

    expect(files).to.deep.equal([
      "artist/one.mp3",
      "genre/one.mp3",
      "global/one.mp3",
    ]);
  });

  it("keeps the final ranked album intact when it crosses the batch target", async () => {
    getByAlbumOrdered.withArgs(2).returns(
      Array.from({ length: 26 }, (_, index) => ({
        file: `artist/${index + 1}.mp3`,
      })),
    );

    const files = await autoplayService.getNextBatch("current/c.mp3");

    expect(files).to.have.length(26);
    expect(files[0]).to.equal("artist/1.mp3");
    expect(files[25]).to.equal("artist/26.mp3");
    expect(files).not.to.include("genre/one.mp3");
  });

  it("does not repeat queued albums and restarts after the cycle is exhausted", async () => {
    const firstBatch = await autoplayService.getNextBatch("current/c.mp3");
    const whileQueued = await autoplayService.getNextBatch("current/c.mp3", {
      queuedFiles: firstBatch,
    });
    const nextCycle = await autoplayService.getNextBatch("current/c.mp3");

    expect(whileQueued).to.deep.equal([]);
    expect(nextCycle).to.deep.equal([
      "artist/one.mp3",
      "genre/one.mp3",
      "global/one.mp3",
    ]);
  });

  it("starts a fresh album cycle when playback is selected manually", async () => {
    await autoplayService.getNextBatch("current/c.mp3");

    autoplayService.resetSession();
    const restarted = await autoplayService.getNextBatch("current/c.mp3");

    expect(restarted).to.deep.equal([
      "artist/one.mp3",
      "genre/one.mp3",
      "global/one.mp3",
    ]);
  });

  it("does not consume albums from the cycle until the batch is committed", async () => {
    getByAlbumOrdered.withArgs(2).returns(
      Array.from({ length: 26 }, (_, index) => ({
        file: `artist/${index + 1}.mp3`,
      })),
    );
    const first = await autoplayService.getNextBatch("current/c.mp3");
    const retry = await autoplayService.getNextBatch("current/c.mp3");

    expect(retry).to.deep.equal(first);
  });

  it("advances past albums after their batch is committed", async () => {
    getByAlbumOrdered.withArgs(2).returns(
      Array.from({ length: 26 }, (_, index) => ({
        file: `artist/${index + 1}.mp3`,
      })),
    );
    const first = await autoplayService.getNextBatch("current/c.mp3");

    autoplayService.commitBatch(first, autoplayService.sessionId);
    const next = await autoplayService.getNextBatch("current/c.mp3");

    expect(next).to.deep.equal(["genre/one.mp3", "global/one.mp3"]);
  });

  it("keeps ranking from the manually selected track as playback advances", async () => {
    autoplayService.resetSession("current/c.mp3", [
      "current/c.mp3",
      "current/d.mp3",
    ]);

    const files = await autoplayService.getNextBatch("genre/one.mp3", {
      queuedFiles: ["genre/one.mp3"],
    });

    expect(files).to.deep.equal(["artist/one.mp3", "global/one.mp3"]);
  });
});
