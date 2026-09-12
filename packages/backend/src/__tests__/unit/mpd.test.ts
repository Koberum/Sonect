import { expect } from "chai";
import {
  parseKeyValue,
  hashFile,
  parseEntities,
  parseMPDMessageToTracks,
} from "../../utils/mpd.js";

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

describe("parseEntities (pure unit)", () => {
  it("parses file entities with metadata", () => {
    const msg = [
      "file: Artist/Album/01 - Track.mp3",
      "Title: My Track",
      "Artist: Test Artist",
      "Album: Test Album",
      "Time: 210",
      "duration: 210.5",
      "OK",
    ].join("\n");
    const entities = parseEntities(msg);
    expect(entities).to.have.length(1);
    expect(entities[0].type).to.equal("file");
    expect(entities[0].path).to.equal("Artist/Album/01 - Track.mp3");
  });

  it("handles multiple entities", () => {
    const msg = "file: a.mp3\nTitle: A\nfile: b.mp3\nTitle: B\nOK";
    expect(parseEntities(msg)).to.have.length(2);
  });
});

describe("parseMPDMessageToTracks (pure unit)", () => {
  it("maps file entities to MPDTrack shape", () => {
    const msg =
      "file: x.mp3\nTitle: Hello\nArtist: World\nAlbum: Test\nGenre: Rock\nTrack: 3\nOK";
    const tracks = parseMPDMessageToTracks(msg);
    expect(tracks).to.have.length(1);
    expect(tracks[0].file).to.equal("x.mp3");
    expect(tracks[0].title).to.equal("Hello");
    expect(tracks[0].genre).to.equal("Rock");
  });

  it("returns empty for non-file entities", () => {
    expect(parseMPDMessageToTracks("directory: foo\nOK")).to.have.length(0);
  });
});
