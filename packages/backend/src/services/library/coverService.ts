import path from "path";
import fs from "fs";
import crypto from "crypto";
import sharp from "sharp";
import * as mm from "music-metadata";
import { albumsDb, tracksDb, artistsDb } from "@repo/db";
import { DBAlbum, DBTrack } from "@repo/types";
import { logService, LogService } from "@services/utils/logService";
import { CoverProgress } from "@repo/types/library";

const COVERS_DIR = process.env.COVERS_DIR || "./data/covers";
const MUSIC_DIR = process.env.MUSIC_DIR ?? "/opt/sonect/music";

const COVER_FILE_NAMES = [
  "cover.jpg",
  "Cover.jpg",
  "folder.jpg",
  "Folder.jpg",
  "cover.png",
  "Cover.png",
  "folder.png",
  "Folder.png",
  "cover.bmp",
  "Cover.bmp",
  "cover.webp",
  "Cover.webp",
  "FrontCover.jpg",
  "frontcover.jpg",
];

export interface CoverService {
  syncAllCovers(
    albums: DBAlbum[],
    onProgress?: (progress: CoverProgress) => void,
  ): Promise<void>;
}

export class CoverServiceImpl implements CoverService {
  constructor(private readonly logService: LogService) {}

  async syncAllCovers(
    albums: DBAlbum[],
    onProgress?: (progress: CoverProgress) => void,
  ): Promise<void> {
    this.ensureCoversDir();
    let done = 0;
    const total = albums.length;

    for (const album of albums) {
      const artistName = album.artist_id
        ? (artistsDb.getById(album.artist_id)?.name ?? "")
        : "";

      if (!(
        album.cover_path &&
        fs.existsSync(path.join(COVERS_DIR, album.cover_path))
      )) {
        try {
          const result = await this.findAndSaveCover(album);
          if (result) {
            albumsDb.updateCoverPath(album.id, result);
          }
        } catch (err) {
          this.logService.pushLog(
            "error",
            `Error extracting cover for album "${album.title}": ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      done++;
      onProgress?.({
        current: done,
        total,
        album: { id: album.id, title: album.title, artist: artistName },
      });
    }
  }

  private async findAndSaveCover(album: DBAlbum): Promise<string | null> {
    const tracks = tracksDb.getByAlbum(album.id);
    if (tracks.length === 0) {
      this.logService.pushLog(
        "warn",
        `No tracks found for album "${album.title}", skipping cover`,
        {
          albumId: album.id,
        },
      );
      return null;
    }

    const albumDir = this.getAlbumDir(tracks);

    const fsCover = this.findFsCover(albumDir);
    if (fsCover) {
      this.logService.pushLog(
        "debug",
        `Filesystem cover found for "${album.title}"`,
        {
          file: fsCover,
        },
      );
      const data = await sharp(fsCover)
        .resize(500, 500, { fit: "inside" })
        .jpeg({ quality: 85 })
        .toBuffer();
      return await this.writeCover(data, album);
    }

    for (const track of tracks) {
      const trackPath = path.join(MUSIC_DIR, track.file);
      try {
        const embedded = await this.extractEmbeddedArt(trackPath);
        if (embedded) {
          this.logService.pushLog(
            "debug",
            `Embedded cover found for "${album.title}" in track: ${track.file}`,
          );
          const data = await sharp(embedded)
            .resize(500, 500, { fit: "inside" })
            .jpeg({ quality: 85 })
            .toBuffer();
          return await this.writeCover(data, album);
        }
      } catch (err) {
        this.logService.pushLog(
          "warn",
          `Failed to extract embedded art from "${track.file}": ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    this.logService.pushLog(
      "info",
      `No cover found for album "${album.title}" (${tracks.length} tracks checked)`,
    );
    return null;
  }

  private findFsCover(albumDir: string): string | null {
    for (const name of COVER_FILE_NAMES) {
      const candidate = path.join(albumDir, name);
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    try {
      const entries = fs.readdirSync(albumDir);
      const imageExts = new Set([
        ".jpg",
        ".jpeg",
        ".png",
        ".webp",
        ".bmp",
        ".gif",
      ]);
      const images = entries
        .filter((f) => !f.startsWith("."))
        .filter((f) => imageExts.has(path.extname(f).toLowerCase()))
        .sort();
      if (images.length > 0) {
        return path.join(albumDir, images[0]);
      }
    } catch {
      // directory unreadable — no fallback
    }

    return null;
  }

  private getAlbumDir(tracks: DBTrack[]): string {
    if (tracks.length === 0) return MUSIC_DIR;

    const dirs = tracks.map((t) => path.dirname(t.file));
    const uniqueDirs = [...new Set(dirs)];

    if (uniqueDirs.length <= 1) {
      return path.join(MUSIC_DIR, uniqueDirs[0] ?? "");
    }

    const partsList = uniqueDirs.map((d) => d.split(path.sep));
    const first = partsList[0];
    let commonLen = first.length;

    for (let i = 1; i < partsList.length; i++) {
      const current = partsList[i];
      let j = 0;
      while (
        j < Math.min(commonLen, current.length) &&
        first[j] === current[j]
      ) {
        j++;
      }
      commonLen = j;
    }

    if (commonLen === 0) {
      return path.join(MUSIC_DIR, dirs[0]);
    }

    return path.join(MUSIC_DIR, ...first.slice(0, commonLen));
  }

  private async extractEmbeddedArt(trackPath: string): Promise<Buffer | null> {
    if (!fs.existsSync(trackPath)) return null;
    const metadata = await mm.parseFile(trackPath, { duration: false });
    const pictures = metadata.common.picture;
    if (!pictures || pictures.length === 0) return null;

    const cover =
      mm.selectCover(pictures) ??
      this.selectFrontCover(pictures) ??
      pictures[0];
    if (!cover) return null;
    return Buffer.from(cover.data);
  }

  private selectFrontCover(pictures: mm.IPicture[]): mm.IPicture | null {
    for (const p of pictures) {
      if (p.type === "Front Cover" || p.type === "Cover (front)") {
        return p;
      }
    }
    return null;
  }

  private async writeCover(data: Buffer, album: DBAlbum): Promise<string> {
    this.ensureCoversDir();

    const artistName = album.artist_id
      ? (artistsDb.getById(album.artist_id)?.name ?? "Unknown")
      : "Unknown";
    const hash = crypto
      .createHash("sha1")
      .update(artistName + album.title)
      .digest("hex");
    const outPath = path.join(COVERS_DIR, `${hash}.jpg`);

    await fs.promises.writeFile(outPath, data);
    return `${hash}.jpg`;
  }

  private ensureCoversDir(): void {
    if (!fs.existsSync(COVERS_DIR)) {
      fs.mkdirSync(COVERS_DIR, { recursive: true });
    }
  }
}

export const coverService: CoverService = new CoverServiceImpl(logService);
