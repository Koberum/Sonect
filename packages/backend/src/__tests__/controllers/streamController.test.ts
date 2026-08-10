import { expect } from "chai";
import sinon from "sinon";
import path from "path";
import fs from "fs";
import os from "os";
import { PassThrough } from "node:stream";
import { streamHandler } from "../../controllers/streamController.js";

describe("Stream Controller", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "stream-test-"));
  const testFile = path.join(tmpDir, "test.flac");
  const fileContent = Buffer.alloc(10000, 0xbb);

  before(() => {
    fs.writeFileSync(testFile, fileContent);
    process.env.MUSIC_DIR = tmpDir;
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    delete process.env.MUSIC_DIR;
  });

  function createMockRes() {
    const self: Record<string, any> = {
      statusCode: 200,
      status: sinon.stub().callsFake(function (this: any, code: number) {
        self.statusCode = code;
        return self;
      }),
      json: sinon.stub().returnsThis(),
      set: sinon.stub().returnsThis(),
      end: sinon.stub().returnsThis(),
      write: sinon.stub(),
      writeHead: sinon.stub().callsFake(function (this: any, code: number) {
        self.statusCode = code;
        return self;
      }),
      on: sinon.stub(),
      once: sinon.stub(),
      emit: sinon.stub(),
    };
    return self;
  }

  it("should return 400 when no filepath provided", async () => {
    const req = { params: {}, headers: {} } as any;
    const res = createMockRes();
    await streamHandler(req, res as any);

    expect(res.status.calledWith(400)).to.be.true;
    expect(res.json.calledOnce).to.be.true;
  });

  it("should handle filepath as array (Express 5 wildcard behavior)", async () => {
    const subDir = path.join(tmpDir, "sub");
    fs.mkdirSync(subDir);
    fs.writeFileSync(path.join(subDir, "test.flac"), Buffer.alloc(500));

    const req = {
      params: { filepath: ["sub", "test.flac"] },
      headers: {},
    } as any;
    const res = createMockRes();
    await streamHandler(req, res as any);

    expect(res.statusCode).to.equal(200);

    fs.rmSync(subDir, { recursive: true, force: true });
  });

  it("should return 403 for path traversal attempts", async () => {
    const req = {
      params: { filepath: "../../../etc/passwd" },
      headers: {},
    } as any;
    const res = createMockRes();
    await streamHandler(req, res as any);

    expect(res.status.calledWith(403)).to.be.true;
  });

  it("should return 404 for non-existent files", async () => {
    const req = {
      params: { filepath: "nonexistent.flac" },
      headers: {},
    } as any;
    const res = createMockRes();
    await streamHandler(req, res as any);

    expect(res.status.calledWith(404)).to.be.true;
  });

  it("should return 206 with partial content for Range requests", async () => {
    const req = {
      params: { filepath: "test.flac" },
      headers: { range: "bytes=0-999" },
    } as any;
    const res = createMockRes();
    await streamHandler(req, res as any);

    expect(res.statusCode).to.equal(206);
  });

  it("should return 200 with full content for non-Range requests", async () => {
    const req = {
      params: { filepath: "test.flac" },
      headers: {},
    } as any;
    const res = createMockRes();
    await streamHandler(req, res as any);

    expect(res.statusCode).to.equal(200);
  });

  it("should return 416 for out-of-range requests", async () => {
    const req = {
      params: { filepath: "test.flac" },
      headers: { range: "bytes=99999-" },
    } as any;
    const res = createMockRes();
    await streamHandler(req, res as any);

    expect(res.statusCode).to.equal(416);
  });

  it("should set correct Content-Type for known extensions", async () => {
    const testMp3 = path.join(tmpDir, "test.mp3");
    fs.writeFileSync(testMp3, Buffer.alloc(1000));

    const req = {
      params: { filepath: "test.mp3" },
      headers: {},
    } as any;
    const res = createMockRes();
    await streamHandler(req, res as any);

    expect(res.statusCode).to.equal(200);
  });

  it("should end the response without crashing when the stream errors after headers are sent", async () => {
    const passthrough = new PassThrough();
    const stub = sinon.stub(fs, "createReadStream").returns(passthrough as any);

    const req = {
      params: { filepath: "test.flac" },
      headers: {},
    } as any;
    const res = createMockRes();
    await streamHandler(req, res as any);

    passthrough.emit("error", new Error("simulated read failure"));
    stub.restore();

    expect(res.statusCode).to.equal(200);
    expect(res.end.called).to.be.true;
  });
});
