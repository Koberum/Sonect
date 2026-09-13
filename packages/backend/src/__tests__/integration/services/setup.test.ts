import { expect } from "chai";
import { createTestDb } from "@tests/helpers/db.js";
import { SetupServiceImpl } from "@services/system/setupService.js";
import { storageDb } from "@repo/db";

// Trophy middle: service + real :memory: DB, no mocks
describe("SetupService (trophy integration)", () => {
  let close: () => void;
  let setup: SetupServiceImpl;

  beforeEach(() => {
    ({ close } = createTestDb());
    setup = new SetupServiceImpl();
  });

  afterEach(() => close());

  describe("getSetupProgress", () => {
    it("returns all steps incomplete when empty", () => {
      const progress = setup.getSetupProgress();
      expect(progress).to.deep.equal([
        { step: "storage", completed: false },
        { step: "audio", completed: false },
        { step: "sync", completed: false },
      ]);
    });

    it("storage step derived from storageDb existence", () => {
      storageDb.create({
        name: "Lib",
        type: "local",
        uri: "/tmp/music",
        mount_path: "/music/lib",
        enabled: true,
      });
      const progress = setup.getSetupProgress();
      expect(progress.find((s) => s.step === "storage")?.completed).to.be.true;
      expect(progress.find((s) => s.step === "audio")?.completed).to.be.false;
    });
  });

  describe("isSetupComplete / markSetupCompleted", () => {
    it("false initially, true after markSetupCompleted", () => {
      expect(setup.isSetupComplete()).to.be.false;
      setup.markSetupCompleted();
      expect(setup.isSetupComplete()).to.be.true;
      // getNextIncompleteStep should still be storage if hasStorage false but complete flag is separate
      expect(setup.getNextIncompleteStep()).to.equal("storage");
    });

    it("complete persists even if storage added", () => {
      setup.markSetupCompleted();
      storageDb.create({
        name: "Lib2",
        type: "local",
        uri: "/tmp/music2",
        mount_path: "/music/lib2",
        enabled: true,
      });
      expect(setup.isSetupComplete()).to.be.true;
    });
  });

  describe("getNextIncompleteStep", () => {
    it("returns first incomplete step in order storage->audio->sync", () => {
      expect(setup.getNextIncompleteStep()).to.equal("storage");
      storageDb.create({
        name: "Lib",
        type: "local",
        uri: "/tmp/a",
        mount_path: "/music/a",
        enabled: true,
      });
      expect(setup.getNextIncompleteStep()).to.equal("audio");
      setup.markStepComplete("audio");
      expect(setup.getNextIncompleteStep()).to.equal("sync");
      setup.markStepComplete("sync");
      expect(setup.getNextIncompleteStep()).to.be.null;
    });
  });

  describe("markStepComplete / markStepIncomplete", () => {
    it("toggles audio and sync steps", () => {
      setup.markStepComplete("audio");
      expect(
        setup.getSetupProgress().find((s) => s.step === "audio")?.completed,
      ).to.be.true;
      setup.markStepIncomplete("audio");
      expect(
        setup.getSetupProgress().find((s) => s.step === "audio")?.completed,
      ).to.be.false;
      setup.markStepComplete("sync");
      expect(setup.getSetupProgress().find((s) => s.step === "sync")?.completed)
        .to.be.true;
    });
  });

  describe("resetSetup", () => {
    it("clears all steps including complete", () => {
      storageDb.create({
        name: "Lib",
        type: "local",
        uri: "/tmp/r",
        mount_path: "/music/r",
        enabled: true,
      });
      setup.markStepComplete("audio");
      setup.markStepComplete("sync");
      setup.markSetupCompleted();
      setup.resetSetup();
      expect(setup.getSetupProgress()).to.deep.equal([
        { step: "storage", completed: true }, // storage derived still true (storageDb not cleared)
        { step: "audio", completed: false },
        { step: "sync", completed: false },
      ]);
      expect(setup.isSetupComplete()).to.be.false;
      expect(setup.getNextIncompleteStep()).to.equal("audio");
    });
  });
});
