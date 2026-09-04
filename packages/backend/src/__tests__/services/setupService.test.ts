import { expect } from "chai";
import sinon from "sinon";
import esmock from "esmock";

describe("Setup Service", () => {
  let setupService: any;
  let setupDbStub: {
    get: sinon.SinonStub;
    setCompleted: sinon.SinonStub;
    setIncomplete: sinon.SinonStub;
  };
  let storageDbStub: { getAll: sinon.SinonStub };

  const allRows: Record<
    string,
    { step: string; completed: boolean } | undefined
  > = {};

  beforeEach(async () => {
    sinon.resetHistory();

    setupDbStub = {
      get: sinon.stub((step: string) => allRows[step]),
      setCompleted: sinon.stub(),
      setIncomplete: sinon.stub(),
    };
    storageDbStub = { getAll: sinon.stub().returns([]) };

    setupService = await esmock(
      new URL("../../services/setupService.ts", import.meta.url).pathname,
      {
        "@repo/db": {
          setupDb: setupDbStub,
          storageDb: storageDbStub,
        },
      },
    );
  });

  afterEach(() => {
    sinon.restore();
    for (const key of Object.keys(allRows)) delete allRows[key];
  });

  describe("getSetupProgress", () => {
    it("marks storage complete when at least one source exists", () => {
      storageDbStub.getAll.returns([{ id: 1, name: "NAS" } as any]);

      const progress = setupService.getSetupProgress();

      expect(progress).to.have.length(3);
      expect(progress[0].step).to.equal("storage");
      expect(progress[0].completed).to.be.true;
      expect(progress[1].step).to.equal("audio");
      expect(progress[2].step).to.equal("sync");
    });

    it("keeps storage incomplete when no source exists", () => {
      storageDbStub.getAll.returns([]);

      const progress = setupService.getSetupProgress();

      expect(progress[0].step).to.equal("storage");
      expect(progress[0].completed).to.be.false;
    });

    it("reflects audio and sync completion from the DB", () => {
      allRows["audio"] = { step: "audio", completed: true };
      allRows["sync"] = { step: "sync", completed: true };

      const progress = setupService.getSetupProgress();

      expect(progress[1].completed).to.be.true;
      expect(progress[2].completed).to.be.true;
    });
  });

  describe("isSetupComplete", () => {
    it("is true when the permanent done flag is set", () => {
      allRows["complete"] = { step: "complete", completed: true };

      expect(setupService.isSetupComplete()).to.be.true;
    });

    it("is false when storage sources exist but no done flag is set", () => {
      storageDbStub.getAll.returns([{ id: 1, name: "NAS" } as any]);

      expect(setupService.isSetupComplete()).to.be.false;
    });

    it("is false on a fresh install", () => {
      expect(setupService.isSetupComplete()).to.be.false;
    });
  });

  describe("getNextIncompleteStep", () => {
    it("returns the first incomplete step", () => {
      storageDbStub.getAll.returns([{ id: 1, name: "NAS" } as any]);

      expect(setupService.getNextIncompleteStep()).to.equal("audio");
    });

    it("returns null when every step is complete", () => {
      storageDbStub.getAll.returns([{ id: 1, name: "NAS" } as any]);
      allRows["audio"] = { step: "audio", completed: true };
      allRows["sync"] = { step: "sync", completed: true };

      expect(setupService.getNextIncompleteStep()).to.be.null;
    });
  });

  describe("markSetupCompleted", () => {
    it("persists the permanent done flag", () => {
      setupService.markSetupCompleted();

      expect(setupDbStub.setCompleted.calledWith("complete")).to.be.true;
    });
  });

  describe("resetSetup", () => {
    it("clears every step plus the done flag", () => {
      setupService.resetSetup();

      for (const step of ["storage", "audio", "sync", "complete"]) {
        expect(setupDbStub.setIncomplete.calledWith(step)).to.be.true;
      }
    });
  });
});
