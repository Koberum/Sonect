import { expect } from "chai";
import { PlayOrder } from "@services/session/playOrder.js";

const reverse = <T>(items: readonly T[]): T[] => [...items].reverse();

describe("PlayOrder", () => {
  it("advances and goes back in natural order", () => {
    const order = new PlayOrder<string>(reverse, () => 0);
    order.reset(["a", "b", "c"], "a");

    expect(order.current).to.equal("a");
    expect(order.peekNext()).to.equal("b");
    expect(order.advance()).to.equal("b");
    expect(order.advance()).to.equal("c");
    expect(order.advance()).to.equal(null);
    expect(order.previous()).to.equal("b");
  });

  it("keeps the current track first when shuffle is enabled", () => {
    const order = new PlayOrder<string>(reverse, () => 0);
    order.reset(["a", "b", "c"], "b");
    order.setRandom(true, ["a", "b", "c"], "b");

    expect(order.random).to.equal(true);
    expect(order.current).to.equal("b");
    expect(order.advance()).to.equal("c");
    expect(order.advance()).to.equal("a");
    expect(order.advance()).to.equal(null);
  });

  it("restores natural order from the current track when shuffle is disabled", () => {
    const order = new PlayOrder<string>(reverse, () => 0);
    order.reset(["a", "b", "c"], "b");
    order.setRandom(true, ["a", "b", "c"], "b");
    order.setRandom(false, ["a", "b", "c"], "b");

    expect(order.random).to.equal(false);
    expect(order.current).to.equal("b");
    expect(order.peekNext()).to.equal("c");
  });

  it("inserts appended items into the remaining shuffled order", () => {
    const order = new PlayOrder<string>(reverse, () => 0);
    order.reset(["a", "b", "c"], "a");
    order.setRandom(true, ["a", "b", "c"], "a");

    order.append("d");

    expect(order.current).to.equal("a");
    expect(order.advance()).to.equal("d");
    expect(order.advance()).to.equal("c");
    expect(order.advance()).to.equal("b");
  });

  it("wraps the queue when repeat is all", () => {
    const order = new PlayOrder<string>(reverse, () => 0);
    order.reset(["a", "b"], "a");
    order.setRepeat("all");

    expect(order.advance()).to.equal("b");
    expect(order.peekNext()).to.equal("a");
    expect(order.advance()).to.equal("a");
    expect(order.repeat).to.equal("all");
  });

  it("repeats the current track when repeat is one", () => {
    const order = new PlayOrder<string>(reverse, () => 0);
    order.reset(["a", "b"], "a");
    order.setRepeat("one");

    expect(order.peekNext()).to.equal("a");
    expect(order.advance()).to.equal("a");
    expect(order.advance()).to.equal("a");
  });

  it("goes to the last track on previous at the start in repeat all", () => {
    const order = new PlayOrder<string>(reverse, () => 0);
    order.reset(["a", "b", "c"], "a");
    order.setRepeat("all");

    expect(order.previous()).to.equal("c");
    expect(order.previous()).to.equal("b");
  });

  it("keeps the next track valid after removing the current entry", () => {
    const order = new PlayOrder<string>(reverse, () => 0);
    order.reset(["a", "b", "c"], "a");
    order.setRandom(true, ["a", "b", "c"], "a");

    order.remove("a");

    expect(order.current).to.equal("c");
    expect(order.advance()).to.equal("b");
  });

  it("plays a selected track next while playing", () => {
    const order = new PlayOrder<string>(reverse, () => 0);
    order.reset(["a", "b", "c"], "a");
    order.setRandom(true, ["a", "b", "c"], "a");

    order.playAt("c", true);

    expect(order.current).to.equal("c");
    expect(order.advance()).to.equal("b");
  });

  it("restarts from the first position", () => {
    const order = new PlayOrder<string>(reverse, () => 0);
    order.reset(["a", "b", "c"], "a");
    order.advance();

    order.restart();

    expect(order.current).to.equal("a");
  });
});
