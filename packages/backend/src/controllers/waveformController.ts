import { asyncHandler } from "@middleware/asyncHandler";
import { getWaveformForTrack } from "@services/library/waveformService";

export const getWaveformHandler = asyncHandler(async (req, res) => {
  const trackId = Number(req.params.trackId);
  if (!Number.isInteger(trackId) || trackId <= 0) {
    res.status(400).json({ message: "trackId must be a positive integer" });
    return;
  }
  const data = await getWaveformForTrack(trackId);
  res.setHeader("Cache-Control", "public, max-age=86400, immutable");
  res.json(data);
});
