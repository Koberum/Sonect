import { expect } from "chai";
import sinon from "sinon";
import { EventEmitter } from "events";
import { mpdConnectionManager } from "../../services/mpdConnectionManager";
import type { PlaybackStatus } from "@repo/types";

const INITIAL_STATUS: PlaybackStatus = {
  state: "stop",
  elapsed: 0,
  duration: 0,
  volume: 50,
  repeat: false,
  random: false,
  single: false,
  consume: false,
};

const PLAYING_STATUS: PlaybackStatus = {
  state: "play",
  elapsed: 30.5,
  duration: 200.0,
  volume: 80,
  repeat: false,
  random: true,
  single: false,
  consume: false,
  track: {
    id: 1,
    title: "Test Track",
    artist_name: "Test Artist",
    cover_path: "abc.jpg",
  },
};

describe("Player WebSocket", () => {
  let setupPlayerWebSocket: Function;

  beforeEach(async () => {
    sinon.stub(mpdConnectionManager, "getCachedStatus").returns(INITIAL_STATUS);

    const wsModule = await import("../../ws/player.ws.ts");
    setupPlayerWebSocket = wsModule.setupPlayerWebSocket;
  });

  afterEach(() => {
    sinon.restore();
  });

  function createMockWs() {
    return Object.assign(new EventEmitter(), {
      send: sinon.stub(),
      readyState: 1,
    });
  }

  function createMockWss(ws: EventEmitter) {
    return {
      on: sinon.stub().callsFake((event: string, handler: Function) => {
        if (event === "connection") {
          handler(ws);
        }
      }),
    } as any;
  }

  it("should send initial cached status on connection", () => {
    const mockWs = createMockWs();
    setupPlayerWebSocket(createMockWss(mockWs));

    expect(mockWs.send.calledOnce).to.be.true;
    const sentData = JSON.parse(mockWs.send.firstCall.args[0]);
    expect(sentData.state).to.equal("stop");
    expect(sentData.volume).to.equal(50);
  });

  it("should send updated status on stateChanged event", () => {
    const mockWs = createMockWs();
    setupPlayerWebSocket(createMockWss(mockWs));

    mockWs.send.resetHistory();

    (mpdConnectionManager.getCachedStatus as sinon.SinonStub).returns(
      PLAYING_STATUS,
    );
    mpdConnectionManager.emit("stateChanged", PLAYING_STATUS);

    expect(mockWs.send.calledOnce).to.be.true;
    const sentData = JSON.parse(mockWs.send.firstCall.args[0]);
    expect(sentData.state).to.equal("play");
    expect(sentData.elapsed).to.equal(30.5);
  });

  it("should stop sending updates after client disconnects", () => {
    const mockWs = createMockWs();
    setupPlayerWebSocket(createMockWss(mockWs));

    mockWs.send.resetHistory();

    mockWs.emit("close");

    (mpdConnectionManager.getCachedStatus as sinon.SinonStub).returns(
      PLAYING_STATUS,
    );
    mpdConnectionManager.emit("stateChanged", PLAYING_STATUS);

    expect(mockWs.send.called).to.be.false;
  });

  it("should handle multiple concurrent connections", () => {
    const ws1 = createMockWs();
    const ws2 = createMockWs();

    const connections: Function[] = [];
    const deferredWss = {
      on: sinon.stub().callsFake((event: string, handler: Function) => {
        if (event === "connection") {
          connections.push(handler);
        }
      }),
    } as any;

    setupPlayerWebSocket(deferredWss);
    connections.forEach((h) => h(ws1));
    connections.forEach((h) => h(ws2));

    ws1.send.resetHistory();
    ws2.send.resetHistory();

    (mpdConnectionManager.getCachedStatus as sinon.SinonStub).returns(
      PLAYING_STATUS,
    );
    mpdConnectionManager.emit("stateChanged", PLAYING_STATUS);

    expect(ws1.send.calledOnce).to.be.true;
    expect(ws2.send.calledOnce).to.be.true;
  });
});
