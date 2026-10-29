import { expect } from "chai";
import { createTestDb } from "@tests/helpers/db.js";
import { artist } from "@tests/factories/artist.js";
import { album } from "@tests/factories/album.js";
import { track } from "@tests/factories/track.js";
import { TrackInfoServiceImpl } from "@services/library/trackInfoService.js";

describe("TrackInfoService", () => {
  let close: () => void;
  const originalMusicDir = process.env.MUSIC_DIR;

  beforeEach(() => {
    ({ close } = createTestDb());
    process.env.MUSIC_DIR = "/libraries";
  });
  afterEach(() => {
    close();
    if (originalMusicDir === undefined) delete process.env.MUSIC_DIR;
    else process.env.MUSIC_DIR = originalMusicDir;
  });

  function seedTrack(file: string, seed: number) {
    const a = artist.create({ name: `PathArtist${seed}` }, seed);
    const al = album.create(
      { title: `PathAlbum${seed}`, artistName: a.name },
      seed,
    );
    return track.create(
      { artist: a.name, album: al.title, title: `PathTrack${seed}`, file },
      seed,
    );
  }

  it("returns null for an unknown track", () => {
    const service = new TrackInfoServiceImpl();
    expect(service.getTrackInfo(999999)).to.equal(null);
  });

  it("resolves a path inside MUSIC_DIR", () => {
    const seeded = seedTrack("Artist/Track.flac", 10);
    const service = new TrackInfoServiceImpl();
    const info = service.getTrackInfo(seeded.id);
    expect(info?.absolutePath).to.equal("/libraries/Artist/Track.flac");
  });

  it("does not expose paths that escape MUSIC_DIR", () => {
    const seeded = seedTrack("../../etc/passwd", 11);
    const service = new TrackInfoServiceImpl();
    const info = service.getTrackInfo(seeded.id);
    expect(info?.file).to.equal("../../etc/passwd");
    expect(info?.absolutePath).to.equal(null);
  });
});
