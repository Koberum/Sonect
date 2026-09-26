import { Request, Response } from "express";
import { playerSchemas, sessionSchemas, systemSchemas } from "@repo/types";
import { asyncHandler } from "@middleware/asyncHandler";
import { resolvePlayerRouter } from "@services/player/playerRouter.js";
import { LockedError } from "../middleware/errorHandler.js";
import { getLogService } from "@services/factory";

function router() {
  return resolvePlayerRouter();
}

function fmtSid(id: string): string {
  return id.slice(0, 8);
}

export const unifiedGetStatusHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const id = req.sessionId as string;
    res.json(router().getStatus(id));
  },
);

export const unifiedPlayHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { file } = playerSchemas.play.parse(req.body);
    const sid = req.sessionId as string;
    const did = (req.deviceId as string | null) ?? null;
    const dName = (req.deviceName as string | null) ?? null;
    const dType = (req.deviceType as string | null) ?? null;
    // Auto-claim browser device on first play if unclaimed
    if (did) router().setActiveDeviceIfUnclaimed(sid, did, dName, dType);
    const mode = router().getMode(sid);
    getLogService().pushLog(
      "debug",
      `[Session ${fmtSid(sid)}][${mode}] play file="${file}"`,
      {
        sessionId: fmtSid(sid),
        mode,
        file,
        deviceId: did?.slice(0, 8),
      },
    );
    if (!file) {
      getLogService().pushLog(
        "warn",
        `[Session ${fmtSid(sid)}] play failed: file required`,
        {
          sessionId: fmtSid(sid),
        },
      );
      res.status(400).json({ error: "file is required" });
      return;
    }
    try {
      await router().forSession(sid).playTrack(file);
      getLogService().pushLog(
        "debug",
        `[Session ${fmtSid(sid)}][${mode}] play ok`,
        {
          sessionId: fmtSid(sid),
          mode,
        },
      );
    } catch (err) {
      getLogService().pushLog(
        "error",
        `[Session ${fmtSid(sid)}][${mode}] play error: ${String(err)}`,
        {
          sessionId: fmtSid(sid),
          mode,
          error: String(err),
        },
      );
      throw err;
    }
    res.json({ success: true });
  },
);

export const unifiedPauseHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const sid = req.sessionId as string;
    const mode = router().getMode(sid);
    getLogService().pushLog(
      "debug",
      `[Session ${fmtSid(sid)}][${mode}] pause`,
      {
        sessionId: fmtSid(sid),
        mode,
      },
    );
    try {
      await router().forSession(sid).pause();
    } catch (err) {
      getLogService().pushLog(
        "error",
        `[Session ${fmtSid(sid)}][${mode}] pause error: ${String(err)}`,
        {
          sessionId: fmtSid(sid),
          mode,
          error: String(err),
        },
      );
      throw err;
    }
    res.json({ success: true });
  },
);

export const unifiedResumeHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const sid = req.sessionId as string;
    const mode = router().getMode(sid);
    getLogService().pushLog(
      "debug",
      `[Session ${fmtSid(sid)}][${mode}] resume`,
      {
        sessionId: fmtSid(sid),
        mode,
      },
    );
    try {
      await router().forSession(sid).resume();
    } catch (err) {
      getLogService().pushLog(
        "error",
        `[Session ${fmtSid(sid)}][${mode}] resume error: ${String(err)}`,
        {
          sessionId: fmtSid(sid),
          mode,
          error: String(err),
        },
      );
      throw err;
    }
    res.json({ success: true });
  },
);

export const unifiedNextHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const sid = req.sessionId as string;
    const mode = router().getMode(sid);
    getLogService().pushLog("debug", `[Session ${fmtSid(sid)}][${mode}] next`, {
      sessionId: fmtSid(sid),
      mode,
    });
    try {
      await router().forSession(sid).next();
    } catch (err) {
      getLogService().pushLog(
        "error",
        `[Session ${fmtSid(sid)}][${mode}] next error: ${String(err)}`,
        {
          sessionId: fmtSid(sid),
          mode,
          error: String(err),
        },
      );
      throw err;
    }
    res.json({ success: true });
  },
);

export const unifiedPreviousHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const sid = req.sessionId as string;
    const mode = router().getMode(sid);
    getLogService().pushLog(
      "debug",
      `[Session ${fmtSid(sid)}][${mode}] previous`,
      {
        sessionId: fmtSid(sid),
        mode,
      },
    );
    try {
      await router().forSession(sid).previous();
    } catch (err) {
      getLogService().pushLog(
        "error",
        `[Session ${fmtSid(sid)}][${mode}] previous error: ${String(err)}`,
        {
          sessionId: fmtSid(sid),
          mode,
          error: String(err),
        },
      );
      throw err;
    }
    res.json({ success: true });
  },
);

export const unifiedSeekHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { position } = playerSchemas.position.parse(req.body);
    const sid = req.sessionId as string;
    const mode = router().getMode(sid);
    getLogService().pushLog(
      "debug",
      `[Session ${fmtSid(sid)}][${mode}] seek position=${position}`,
      {
        sessionId: fmtSid(sid),
        mode,
        position,
      },
    );
    try {
      await router().forSession(sid).seek(position);
    } catch (err) {
      getLogService().pushLog(
        "error",
        `[Session ${fmtSid(sid)}][${mode}] seek error: ${String(err)}`,
        {
          sessionId: fmtSid(sid),
          mode,
          error: String(err),
        },
      );
      throw err;
    }
    res.json({ success: true });
  },
);

export const unifiedGetQueueHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const q = await router()
      .forSession(req.sessionId as string)
      .getQueue();
    res.json(q);
  },
);

export const unifiedAddToQueueHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { file } = playerSchemas.addToQueue.parse(req.body);
    const sid = req.sessionId as string;
    getLogService().pushLog(
      "debug",
      `[Session ${fmtSid(sid)}][${router().getMode(sid)}] addToQueue file="${file}"`,
      {
        sessionId: fmtSid(sid),
        file,
      },
    );
    await router().forSession(sid).addToQueue(file);
    res.json({ success: true });
  },
);

export const unifiedRemoveFromQueueHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { pos } = sessionSchemas.queuePos.parse(req.params);
    const sid = req.sessionId as string;
    getLogService().pushLog(
      "debug",
      `[Session ${fmtSid(sid)}][${router().getMode(sid)}] removeFromQueue pos=${pos}`,
      {
        sessionId: fmtSid(sid),
        pos,
      },
    );
    await router().forSession(sid).removeFromQueue(pos);
    res.json({ success: true });
  },
);

export const unifiedMoveQueueHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { from, to } = playerSchemas.moveQueue.parse(req.body);
    const sid = req.sessionId as string;
    getLogService().pushLog(
      "debug",
      `[Session ${fmtSid(sid)}][${router().getMode(sid)}] moveQueue ${from}→${to}`,
      {
        sessionId: fmtSid(sid),
        from,
        to,
      },
    );
    await router().forSession(sid).moveQueueItem(from, to);
    res.json({ success: true });
  },
);

export const unifiedPlayPositionHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { pos } = playerSchemas.playPosition.parse(req.body);
    const sid = req.sessionId as string;
    getLogService().pushLog(
      "debug",
      `[Session ${fmtSid(sid)}][${router().getMode(sid)}] playPosition pos=${pos}`,
      {
        sessionId: fmtSid(sid),
        pos,
      },
    );
    await router().forSession(sid).playPosition(pos);
    res.json({ success: true });
  },
);

export const unifiedSetVolumeHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { volume } = playerSchemas.volume.parse(req.body);
    const sid = req.sessionId as string;
    getLogService().pushLog(
      "debug",
      `[Session ${fmtSid(sid)}][${router().getMode(sid)}] setVolume ${volume}`,
      {
        sessionId: fmtSid(sid),
        volume,
      },
    );
    // Browser volume is stored per-profile in PlayerRouter; MPD delegates to engine
    const r = router() as unknown as {
      setVolume?: (a: string, b: number) => Promise<void>;
    };
    if (r.setVolume) await r.setVolume(sid, volume);
    else await router().forSession(sid).setVolume(volume);
    res.json({ success: true });
  },
);

export const unifiedGetOutputModeHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const id = req.sessionId as string;
    const r = router();
    const mode = r.getMode(id);
    const activeDeviceId = r.getActiveDevice(id);
    const activeDeviceName = r.getActiveDeviceName(id);
    const activeDeviceType = r.getActiveDeviceType(id);
    getLogService().pushLog(
      "debug",
      `[Session ${fmtSid(id)}] getOutputMode → ${mode} active=${activeDeviceId?.slice(0, 8) ?? "null"}`,
      {
        sessionId: fmtSid(id),
        mode,
        activeDeviceId: activeDeviceId?.slice(0, 8),
      },
    );
    res.json({
      mode,
      deviceName: r.getOutputDeviceName(),
      mpdOwner: r.getMpdOwner(),
      activeDeviceId,
      activeDeviceName,
      activeDeviceType,
    });
  },
);

export const unifiedSetOutputModeHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { mode, deviceId: bodyDeviceId } = systemSchemas.outputMode.parse(
      req.body,
    );
    const id = req.sessionId as string;
    const deviceId =
      (bodyDeviceId as string | undefined) ??
      (req.deviceId as string | null) ??
      undefined;
    const deviceName = (req.deviceName as string | null) ?? null;
    const deviceType = (req.deviceType as string | null) ?? null;
    getLogService().pushLog(
      "debug",
      `[Session ${fmtSid(id)}] setOutputMode → ${mode} device=${deviceId?.slice(0, 8) ?? "null"}`,
      {
        sessionId: fmtSid(id),
        mode,
        deviceId: deviceId?.slice(0, 8),
      },
    );
    const result = await router().setMode(
      id,
      mode,
      deviceId ?? null,
      deviceName,
      deviceType,
    );
    if (!result.success) {
      getLogService().pushLog(
        "warn",
        `[Session ${fmtSid(id)}] setOutputMode failed: ${result.warning}`,
        {
          sessionId: fmtSid(id),
          mode,
          warning: result.warning,
        },
      );
      throw new LockedError(result.warning ?? "MPD locked by another session");
    }
    getLogService().pushLog(
      "info",
      `[Session ${fmtSid(id)}] outputMode set to ${mode}`,
      {
        sessionId: fmtSid(id),
        mode,
      },
    );
    res.json(result);
  },
);

export const unifiedEnableRandomHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { enabled } = playerSchemas.toggle.parse(req.body);
    const sid = req.sessionId as string;
    getLogService().pushLog(
      "debug",
      `[Session ${fmtSid(sid)}][${router().getMode(sid)}] setRandom ${enabled}`,
      {
        sessionId: fmtSid(sid),
        enabled,
      },
    );
    await router().forSession(sid).enableRandom(enabled);
    res.json({ success: true });
  },
);

export const unifiedEnableRepeatHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { enabled } = playerSchemas.toggle.parse(req.body);
    const sid = req.sessionId as string;
    getLogService().pushLog(
      "debug",
      `[Session ${fmtSid(sid)}][${router().getMode(sid)}] setRepeat ${enabled}`,
      {
        sessionId: fmtSid(sid),
        enabled,
      },
    );
    await router().forSession(sid).enableRepeat(enabled);
    res.json({ success: true });
  },
);
