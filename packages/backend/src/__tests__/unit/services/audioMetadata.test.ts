import { expect } from "chai";
import { mapAudioMetadata } from "@services/library/audioMetadata.js";

describe("mapAudioMetadata", () => {
  it("maps common tags to MPDTrack", () => {
    const t = mapAudioMetadata(
      {
        file: "a/b.mp3",
        mtimeMs: 1700000000000,
        size: 10,
        common: {
          title: "Song",
          artist: "Artist",
          albumartist: "Album Artist",
          album: "Album",
          genre: ["Rock"],
          track: { no: 3, of: 10 },
          disk: { no: 1, of: 1 },
          date: "2020-05-01",
        } as never,
        format: { duration: 201.5 } as never,
      },
      "b",
    );
    expect(t).to.deep.equal({
      file: "a/b.mp3",
      title: "Song",
      artist: "Artist",
      albumArtist: "Album Artist",
      album: "Album",
      genre: "Rock",
      track: 3,
      disc: "1",
      date: "2020-05-01",
      duration: 201.5,
      mtime: 1700000000000,
      size: 10,
      lastModified: new Date(1700000000000).toISOString(),
    });
  });

  it("falls back to filename title and null-ish tags when metadata is empty", () => {
    const t = mapAudioMetadata(
      { file: "a/unknown.mp3", mtimeMs: 1, size: 2 },
      "unknown",
    );
    expect(t.title).to.equal("unknown");
    expect(t.artist).to.be.undefined;
    expect(t.album).to.be.undefined;
  });

  it("derives date from year and artist from artists[] when artist is absent", () => {
    const t = mapAudioMetadata(
      {
        file: "a/c.mp3",
        mtimeMs: 2,
        size: 3,
        common: {
          artists: ["Someone"],
          year: 1999,
          disk: { no: 2 },
        } as never,
      },
      "c",
    );
    expect(t.artist).to.equal("Someone");
    expect(t.date).to.equal("1999");
    expect(t.disc).to.equal("2");
    expect(t.albumArtist).to.be.undefined;
    expect(t.genre).to.be.undefined;
    expect(t.track).to.be.undefined;
    expect(t.duration).to.be.undefined;
  });
});
