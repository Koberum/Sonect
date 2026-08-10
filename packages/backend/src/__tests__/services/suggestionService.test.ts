import { expect } from "chai";
import sinon from "sinon";
import esmock from "esmock";

describe("SuggestionService", () => {
  const mockAlbums = [
    {
      id: 1,
      title: "Test Album",
      artist_id: 1,
      cover_path: "/covers/abc.jpg",
      year: 2024,
      genre: "Rock",
      created_at: "2024-01-01",
      updated_at: "2024-01-01",
      last_played: "2024-06-15",
    },
  ];

  const mockTracks = [
    {
      id: 1,
      file: "/music/test.mp3",
      title: "Test Track",
      artist_id: 1,
      album_id: 1,
      duration: 200,
      genre: "Rock",
      play_count: 5,
      last_played: "2024-06-15",
      artist_name: "Test Artist",
      album_title: "Test Album",
      cover_path: "/covers/abc.jpg",
    },
  ];

  const mockGenres = ["Rock", "Pop", "Jazz"];
  const mockArtists = [
    { id: 1, name: "Test Artist", total: 10 },
    { id: 2, name: "Another Artist", total: 5 },
  ];

  describe("getDashboard", () => {
    it("returns all 5 fields with correct types", async () => {
      const { SuggestionService } = await esmock(
        "../../services/suggestionService.ts",
        {
          "@repo/db": {
            albumsDb: {
              getRecentAlbums: sinon.stub().returns(mockAlbums),
            },
            tracksDb: {
              getRecentlyPlayed: sinon.stub().returns(mockTracks),
              getTopTracks: sinon.stub().returns(mockTracks),
              getTopGenres: sinon.stub().returns(mockGenres),
              getTopArtists: sinon.stub().returns(mockArtists),
              getTracksForDiscovery: sinon.stub().returns(mockTracks),
              getTopGenre: sinon.stub().returns("Rock"),
              getTracksByGenre: sinon.stub().returns(mockTracks),
            },
          },
        },
      );

      const service = new SuggestionService();
      const result = await service.getDashboard();

      expect(result).to.have.all.keys(
        "continueListening",
        "recentlyPlayed",
        "topTracks",
        "suggestedTracks",
        "genreQuickMix",
      );

      expect(result.continueListening).to.be.an("array");
      expect(result.recentlyPlayed).to.be.an("array");
      expect(result.topTracks).to.be.an("array");
      expect(result.suggestedTracks).to.be.an("array");
      expect(result.genreQuickMix).to.be.an("object").that.is.not.null;
      expect(result.genreQuickMix).to.have.all.keys("genre", "tracks");
      expect(result.genreQuickMix!.tracks).to.be.an("array");
    });

    it("passes excludeAlbumId to getRecentAlbums", async () => {
      const getRecentAlbumsStub = sinon.stub().returns([]);

      const { SuggestionService } = await esmock(
        "../../services/suggestionService.ts",
        {
          "@repo/db": {
            albumsDb: { getRecentAlbums: getRecentAlbumsStub },
            tracksDb: {
              getRecentlyPlayed: sinon.stub().returns([]),
              getTopTracks: sinon.stub().returns([]),
              getTopGenres: sinon.stub().returns([]),
              getTopArtists: sinon.stub().returns([]),
              getTracksForDiscovery: sinon.stub().returns([]),
              getTopGenre: sinon.stub().returns(null),
              getTracksByGenre: sinon.stub().returns([]),
            },
          },
        },
      );

      const svc = new SuggestionService();
      await svc.getDashboard(42);

      sinon.assert.calledWith(getRecentAlbumsStub, 10, 42);
    });
  });

  describe("with empty data", () => {
    it("returns empty arrays and null genreQuickMix", async () => {
      const { SuggestionService } = await esmock(
        "../../services/suggestionService.ts",
        {
          "@repo/db": {
            albumsDb: { getRecentAlbums: sinon.stub().returns([]) },
            tracksDb: {
              getRecentlyPlayed: sinon.stub().returns([]),
              getTopTracks: sinon.stub().returns([]),
              getTopGenres: sinon.stub().returns([]),
              getTopArtists: sinon.stub().returns([]),
              getTracksForDiscovery: sinon.stub().returns([]),
              getTopGenre: sinon.stub().returns(null),
              getTracksByGenre: sinon.stub().returns([]),
            },
          },
        },
      );

      const svc = new SuggestionService();
      const result = await svc.getDashboard();

      expect(result.continueListening).to.be.empty;
      expect(result.recentlyPlayed).to.be.empty;
      expect(result.topTracks).to.be.empty;
      expect(result.suggestedTracks).to.be.empty;
      expect(result.genreQuickMix).to.be.null;
    });
  });

  describe("genreQuickMix", () => {
    it("is null when no top genre exists", async () => {
      const { SuggestionService } = await esmock(
        "../../services/suggestionService.ts",
        {
          "@repo/db": {
            albumsDb: { getRecentAlbums: sinon.stub().returns([]) },
            tracksDb: {
              getRecentlyPlayed: sinon.stub().returns([]),
              getTopTracks: sinon.stub().returns([]),
              getTopGenres: sinon.stub().returns([]),
              getTopArtists: sinon.stub().returns([]),
              getTracksForDiscovery: sinon.stub().returns([]),
              getTopGenre: sinon.stub().returns(null),
              getTracksByGenre: sinon.stub().returns([]),
            },
          },
        },
      );

      const svc = new SuggestionService();
      const result = await svc.getDashboard();

      expect(result.genreQuickMix).to.be.null;
    });

    it("returns genre and tracks when top genre exists", async () => {
      const { SuggestionService } = await esmock(
        "../../services/suggestionService.ts",
        {
          "@repo/db": {
            albumsDb: { getRecentAlbums: sinon.stub().returns([]) },
            tracksDb: {
              getRecentlyPlayed: sinon.stub().returns([]),
              getTopTracks: sinon.stub().returns([]),
              getTopGenres: sinon.stub().returns([]),
              getTopArtists: sinon.stub().returns([]),
              getTracksForDiscovery: sinon.stub().returns([]),
              getTopGenre: sinon.stub().returns("Rock"),
              getTracksByGenre: sinon.stub().returns([
                { id: 1, title: "A", genre: "Rock" },
                { id: 2, title: "B", genre: "Rock" },
              ]),
            },
          },
        },
      );

      const svc = new SuggestionService();
      const result = await svc.getDashboard();

      expect(result.genreQuickMix).to.not.be.null;
      expect(result.genreQuickMix!.genre).to.equal("Rock");
      expect(result.genreQuickMix!.tracks).to.have.lengthOf(2);
    });
  });
});
