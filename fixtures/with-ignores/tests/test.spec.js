// Test file - should be ignored
describe("nomerge detection", () => {
  it("should find nomerge patterns", () => {
    expect(hasPattern("nomerge")).toBe(true);
  });
});
