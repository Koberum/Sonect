import { expect } from "chai";
import { parseKeyValue, hashFile, parseMPDTracks } from "../../../utils/mpd.js";

// Layer 1: Pure functions — no DB, no mocks, cheap & fast
describe("parseKeyValue (pure unit)", () => {
  it("parses colon-separated lines", () => {
    const msg = "state: play\nvolume: 80\nelapsed: 12.5\nOK";
    const kv = parseKeyValue(msg);
    expect(kv.state).to.equal("play");
    expect(kv.volume).to.equal("80");
    expect(kv.elapsed).to.equal("12.5");
  });

  it("returns empty object for empty input", () => {
    expect(parseKeyValue("")).to.deep.equal({});
  });

  it("ignores lines without colon", () => {
    const kv = parseKeyValue("OK\nstate: pause");
    expect(kv.state).to.equal("pause");
    expect(kv).to.not.have.property("OK");
  });
});

describe("parseMPDTracks (pure unit)", () => {
  it("parses paged find records with tags and Last-Modified", () => {
    const msg = [
      "file: lib/a.mp3",
      "Last-Modified: 2026-01-02T03:04:05Z",
      "Format: 44100:16:2",
      "Title: A",
      "Artist: Artist",
      "Album: Album",
      "AlbumArtist: Album Artist",
      "Genre: Rock",
      "Track: 3/10",
      "Disc: 1",
      "Date: 2020-01-01",
      "Time: 180",
      "duration: 180.5",
    ].join("\n");

    expect(parseMPDTracks(msg)[0]).to.deep.equal({
      file: "lib/a.mp3",
      lastModified: "2026-01-02T03:04:05Z",
      format: "44100:16:2",
      title: "A",
      artist: "Artist",
      album: "Album",
      albumArtist: "Album Artist",
      genre: "Rock",
      track: 3,
      disc: "1",
      date: "2020-01-01",
      duration: 180.5,
    });
  });

  it("ignores directory records and songs without file", () => {
    const msg =
      "directory: lib\nLast-Modified: 2026-01-01T00:00:00Z\nfile: lib/a.mp3\nTitle: A";
    expect(parseMPDTracks(msg).map((t) => t.file)).to.deep.equal(["lib/a.mp3"]);
  });

  it("uses Time when duration is absent", () => {
    expect(parseMPDTracks("file: a.mp3\nTime: 42")[0].duration).to.equal(42);
  });

  it("keeps the first value of multi-valued tags", () => {
    const parsed = parseMPDTracks(
      "file: a.mp3\nArtist: First\nArtist: Second\nGenre: Rock\nGenre: Pop",
    )[0];
    expect(parsed.artist).to.equal("First");
    expect(parsed.genre).to.equal("Rock");
  });
});

describe("hashFile (pure unit)", () => {
  it("is deterministic", () => {
    expect(hashFile("a/b/c.mp3")).to.equal(hashFile("a/b/c.mp3"));
  });
  it("differs for different paths", () => {
    expect(hashFile("a.mp3")).to.not.equal(hashFile("b.mp3"));
  });
  it("returns non-negative integer", () => {
    expect(hashFile("test/file.flac")).to.be.a("number");
    expect(hashFile("test/file.flac")).to.be.greaterThanOrEqual(0);
  });
});
