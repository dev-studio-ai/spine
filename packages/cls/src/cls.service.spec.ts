import { ClsService } from "./cls.service";

describe("ClsService", () => {
  it("reads and writes within an active scope", () => {
    const cls = new ClsService();
    cls.run({ user: "alice" }, () => {
      expect(cls.get<string>("user")).toBe("alice");
      cls.set("reqId", "r-1");
      expect(cls.get<string>("reqId")).toBe("r-1");
      expect(cls.has("user")).toBe(true);
      expect(cls.has("missing")).toBe(false);
    });
  });

  it("reports whether a scope is active", () => {
    const cls = new ClsService();
    expect(cls.active).toBe(false);
    cls.run({}, () => expect(cls.active).toBe(true));
    expect(cls.active).toBe(false);
  });

  it("returns undefined and throws outside a scope", () => {
    const cls = new ClsService();
    expect(cls.get("user")).toBeUndefined();
    expect(() => cls.set("user", "x")).toThrow(/outside an active scope/);
  });

  it("does not leak writes back into the seed object", () => {
    const cls = new ClsService();
    const seed = { user: "alice" };
    cls.run(seed, () => cls.set("reqId", "r-1"));
    expect(seed).toEqual({ user: "alice" }); // seed was cloned
  });

  it("isolates concurrent scopes (the core guarantee)", async () => {
    const cls = new ClsService();
    const readBack = (user: string) =>
      cls.run({ user }, async () => {
        await new Promise((r) => setTimeout(r, 5)); // force interleaving
        return cls.get<string>("user");
      });
    const [a, b] = await Promise.all([readBack("alice"), readBack("bob")]);
    expect(a).toBe("alice");
    expect(b).toBe("bob");
  });
});
