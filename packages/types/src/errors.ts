// Custom error class
export class PlayTrackError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlayTrackError";
  }
}
