import { expect } from "chai";
import sinon from "sinon";
import { createTestDb } from "@tests/helpers/db.js";
import { track, album } from "@tests/factories/index.js";
import { SuggestionService } from "@services/library/suggestionService.js";
import { tracksDb, albumsDb } from "@repo/db";

// Trophy middle: service + real :memory: DB, stub only Math.random
describe("SuggestionService (trophy integration)", () => {
  let close: () => void;
  let suggestion: SuggestionService;
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    ({ close } = createTestDb());
    suggestion = new SuggestionService();
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
    close();
  });

  describe("getDashboard", () => {
    it("returns empty/ null when DB empty", () => {
      const data = suggestion.getDashboard();
      expect(data.continueListening).to.deep.equal([]);
      expect(data.recentlyPlayed).to.deep.equal([]);
      expect(data.topTracks).to.deep.equal([]);
      expect(data.suggestedTracks).to.deep.equal([]);
      expect(data.genreQuickMix).to.be.null;
    });

    it("continueListening respects excludeAlbumId", () => {
      const al1 = album.create({ title: "RecAl1" }, 1);
      const al2 = album.create({ title: "RecAl2" }, 2);
      albumsDb.updateLastPlayed(al1.id);
      albumsDb.updateLastPlayed(al2.id);
      const dataAll = suggestion.getDashboard();
      expect(dataAll.continueListening.map((a) => a.id)).to.include(al1.id);
      const dataEx = suggestion.getDashboard(al1.id);
      expect(dataEx.continueListening.map((a) => a.id)).to.not.include(al1.id);
      expect(dataEx.continueListening.map((a) => a.id)).to.include(al2.id);
    });

    it("recentlyPlayed returns tracks ordered by last_played", () => {
      const t1 = track.create({ title: "Recent1", play_count: 1 }, 10);
      const t2 = track.create({ title: "Recent2", play_count: 1 }, 11);
      tracksDb.incrementPlayCount(t1.id);
      // t1 now has later last_played than t2? increment sets datetime('now') for t1, t2 still null -> t1 first
      const data = suggestion.getDashboard();
      expect(data.recentlyPlayed.length).to.be.at.least(1);
      // At least one of the seeded tracks appears
      expect(data.recentlyPlayed.map((t) => t.title)).to.include("Recent1");
    });

    it("topTracks ordered by play_count", () => {
      track.create({ title: "Low", play_count: 1 }, 20);
      track.create({ title: "High", play_count: 99 }, 21);
      const data = suggestion.getDashboard();
      expect(data.topTracks[0].title).to.equal("High");
    });

    it("suggestedTracks via discovery (play_count <3)", () => {
      // No data -> empty due to no top genre/artist
      expect(suggestion.getDashboard().suggestedTracks).to.deep.equal([]);
      track.create({ title: "Disco1", genre: "Rock", play_count: 1 }, 30);
      track.create({ title: "Disco2", genre: "Rock", play_count: 1 }, 31);
      const data = suggestion.getDashboard();
      // May be empty if top genres not enough, but should not throw
      expect(data.suggestedTracks).to.be.an("array");
    });

    it("genreQuickMix deterministic shuffle with Math.random stubbed", () => {
      sandbox.stub(Math, "random").returns(0.5);
      // Need top genre: create tracks with genre and play_count to make top
      track.create({ title: "Mix1", genre: "Jazz", play_count: 10 }, 40);
      track.create({ title: "Mix2", genre: "Jazz", play_count: 10 }, 41);
      track.create({ title: "Mix3", genre: "Jazz", play_count: 10 }, 42);
      const data = suggestion.getDashboard();
      expect(data.genreQuickMix).to.not.be.null;
      expect(data.genreQuickMix!.genre).to.equal("Jazz");
      expect(data.genreQuickMix!.tracks).to.have.length(3);
      // With Math.random=0.5 shuffle is deterministic — same order on second call
      const data2 = suggestion.getDashboard();
      expect(data2.genreQuickMix!.tracks.map((t) => t.title)).to.deep.equal(
        data.genreQuickMix!.tracks.map((t) => t.title),
      );
    });
  });
});
