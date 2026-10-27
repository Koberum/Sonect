import { expect } from "chai";
import sinon from "sinon";
import { createTestDb } from "@tests/helpers/db.js";
import { track, album } from "@tests/factories/index.js";
import { SuggestionService } from "@services/library/suggestionService.js";
import { playHistoryDb, profilesDb } from "@repo/db";

// Trophy middle: service + real :memory: DB, stub only Math.random
describe("SuggestionService (trophy integration)", () => {
  let close: () => void;
  let suggestion: SuggestionService;
  let profileId: string;
  let otherProfileId: string;
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    ({ close } = createTestDb());
    profileId = profilesDb.create({
      name: "Listener",
      passwordHash: "hash",
    });
    otherProfileId = profilesDb.create({
      name: "Other",
      passwordHash: "hash",
    });
    suggestion = new SuggestionService();
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
    close();
  });

  describe("getDashboard", () => {
    it("returns empty arrays and null when DB empty", () => {
      const data = suggestion.getDashboard(profileId);
      expect(data.recentlyPlayedAlbums).to.deep.equal([]);
      expect(data.recentlyPlayedArtists).to.deep.equal([]);
      expect(data.recentlyPlayed).to.deep.equal([]);
      expect(data.topTracks).to.deep.equal([]);
      expect(data.suggestedTracks).to.deep.equal([]);
      expect(data.genreQuickMix).to.be.null;
    });

    it("recentlyPlayedAlbums is scoped per profile and respects excludeAlbumId", () => {
      const al1 = album.create({ title: "RecAl1" }, 1);
      const al2 = album.create({ title: "RecAl2" }, 2);
      const t1 = track.create({ album: "RecAl1", title: "Rec1" }, 3);
      const t2 = track.create({ album: "RecAl2", title: "Rec2" }, 4);
      playHistoryDb.record(profileId, t1.id, 1000);
      playHistoryDb.record(profileId, t2.id, 2000);
      playHistoryDb.record(otherProfileId, t1.id, 3000);

      const dataAll = suggestion.getDashboard(profileId);
      expect(dataAll.recentlyPlayedAlbums.map((a) => a.id)).to.deep.equal([
        al2.id,
        al1.id,
      ]);

      const dataEx = suggestion.getDashboard(profileId, al2.id);
      expect(dataEx.recentlyPlayedAlbums.map((a) => a.id)).to.deep.equal([
        al1.id,
      ]);

      const other = suggestion.getDashboard(otherProfileId);
      expect(other.recentlyPlayedAlbums.map((a) => a.id)).to.deep.equal([
        al1.id,
      ]);
    });

    it("recentlyPlayedArtists ordered by latest track play", () => {
      const t1 = track.create(
        {
          title: "ArtistA1",
          artist: "Artist A",
          last_played: "2026-01-01 10:00:00",
        },
        50,
      );
      const t2 = track.create(
        {
          title: "ArtistB1",
          artist: "Artist B",
          last_played: "2026-01-02 10:00:00",
        },
        51,
      );
      playHistoryDb.record(profileId, t1.id, 1000);
      playHistoryDb.record(profileId, t2.id, 2000);

      const data = suggestion.getDashboard(profileId);

      expect(data.recentlyPlayedArtists.map((a) => a.name)).to.deep.equal([
        "Artist B",
        "Artist A",
      ]);
      expect(data.recentlyPlayedArtists[0].coverPreviews).to.be.an("array");
    });

    it("recentlyPlayed returns tracks ordered by latest play", () => {
      const t1 = track.create({ title: "Recent1" }, 10);
      const t2 = track.create({ title: "Recent2" }, 11);
      playHistoryDb.record(profileId, t1.id, 1000);
      playHistoryDb.record(profileId, t2.id, 2000);

      const data = suggestion.getDashboard(profileId);
      expect(data.recentlyPlayed.map((t) => t.title)).to.deep.equal([
        "Recent2",
        "Recent1",
      ]);
    });

    it("topTracks ordered by per-profile play count", () => {
      const low = track.create({ title: "Low" }, 20);
      const high = track.create({ title: "High" }, 21);
      playHistoryDb.record(profileId, low.id, 1000);
      playHistoryDb.record(profileId, high.id, 2000);
      playHistoryDb.record(profileId, high.id, 3000);
      playHistoryDb.record(otherProfileId, low.id, 4000);
      playHistoryDb.record(otherProfileId, low.id, 5000);

      const data = suggestion.getDashboard(profileId);
      expect(data.topTracks.map((t) => t.title)).to.deep.equal(["High", "Low"]);
    });

    it("suggestedTracks fall back to random library tracks without history", () => {
      for (let i = 0; i < 3; i++) {
        track.create({ title: `Library${i}`, genre: "Rock" }, 30 + i);
      }

      const data = suggestion.getDashboard(profileId);
      expect(data.suggestedTracks).to.have.length(3);
      expect(data.suggestedTracks.map((t) => t.title)).to.include("Library0");
    });

    it("suggestedTracks uses per-profile discovery (<3 plays)", () => {
      const played = track.create(
        { title: "Played3x", genre: "Rock", artist: "Rock Artist" },
        40,
      );
      const fresh = track.create(
        { title: "Fresh", genre: "Rock", artist: "Rock Artist" },
        41,
      );
      for (const at of [1000, 2000, 3000]) {
        playHistoryDb.record(profileId, played.id, at);
      }

      const data = suggestion.getDashboard(profileId);
      const ids = data.suggestedTracks.map((t) => t.id);
      expect(ids).to.include(fresh.id);
      expect(ids).to.not.include(played.id);
    });

    it("genreQuickMix falls back to the library's most common genre", () => {
      track.create({ title: "Jazz1", genre: "Jazz" }, 60);
      track.create({ title: "Jazz2", genre: "Jazz" }, 61);
      track.create({ title: "Rock1", genre: "Rock" }, 62);

      const data = suggestion.getDashboard(profileId);
      expect(data.genreQuickMix).to.not.be.null;
      expect(data.genreQuickMix!.genre).to.equal("Jazz");
      expect(data.genreQuickMix!.tracks).to.have.length(2);
    });

    it("genreQuickMix uses the profile's top genre", () => {
      const jazz = track.create({ title: "Jazz1", genre: "Jazz" }, 70);
      const rock = track.create({ title: "Rock1", genre: "Rock" }, 71);
      playHistoryDb.record(profileId, jazz.id, 1000);
      playHistoryDb.record(profileId, rock.id, 2000);
      playHistoryDb.record(profileId, rock.id, 3000);

      const data = suggestion.getDashboard(profileId);
      expect(data.genreQuickMix!.genre).to.equal("Rock");
    });

    it("genreQuickMix deterministic shuffle with Math.random stubbed", () => {
      sandbox.stub(Math, "random").returns(0.5);
      track.create({ title: "Mix1", genre: "Jazz" }, 80);
      track.create({ title: "Mix2", genre: "Jazz" }, 81);
      track.create({ title: "Mix3", genre: "Jazz" }, 82);

      const data = suggestion.getDashboard(profileId);
      expect(data.genreQuickMix).to.not.be.null;
      expect(data.genreQuickMix!.genre).to.equal("Jazz");
      expect(data.genreQuickMix!.tracks).to.have.length(3);
      const data2 = suggestion.getDashboard(profileId);
      expect(data2.genreQuickMix!.tracks.map((t) => t.title)).to.deep.equal(
        data.genreQuickMix!.tracks.map((t) => t.title),
      );
    });
  });
});
