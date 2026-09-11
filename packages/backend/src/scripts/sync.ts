import "dotenv/config";
import { initDatabase } from "@repo/db";
import { initializeServices, getLibrarySyncService } from "@services/factory";

async function main() {
  try {
    await initDatabase();
    initializeServices();

    const librarySyncService = getLibrarySyncService();

    const command = process.argv[2];

    switch (command) {
      case "sync":
        await librarySyncService.syncAll();
        break;

      case "stats": {
        const stats = await librarySyncService.getStats();
        console.log("📊 Database Statistics:");
        console.log(`   Total tracks: ${stats.totalTracks}`);
        console.log(`   Last sync: ${stats.lastSync || "Never"}`);
        break;
      }

      case "clear":
        console.log("⚠️  WARNING: This will delete all data!");
        await librarySyncService.clearAll();
        break;

      default:
        console.log("Usage:");
        console.log("  pnpm backend:sync sync     - Sync all tracks from MPD");
        console.log("  pnpm backend:sync stats    - Show database statistics");
        console.log("  pnpm backend:sync clear    - Clear all database data");
        break;
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

main();
