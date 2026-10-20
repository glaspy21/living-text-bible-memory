import { describe, expect, it } from "vitest";
import { adminNavItem, listenerScreen, readerTitle } from "./routes";

describe("listenerScreen", () => {
  it.each([
    ["/", "home", "/"],
    ["/read/john/1", "read", "/read"],
    ["/memorize", "choice", "/memorize"],
    ["/memorize/steps", "steps", "/memorize"],
    ["/memorize/range", "range", "/memorize"],
    ["/memorize/flashcards", "cards", "/memorize/flashcards"],
    ["/nowhere", "other", null],
  ])("%s is the %s screen with %s highlighted", (path, id, nav) => {
    expect(listenerScreen(path)).toMatchObject({ id, nav });
  });

  it("titles the reader with its reference", () => {
    expect(listenerScreen("/read/psalms/23").title).toBe("Psalms 23");
  });

  it("ignores a trailing slash", () => {
    expect(listenerScreen("/memorize/")).toMatchObject({ id: "choice" });
  });
});

describe("readerTitle", () => {
  it("turns a book slug and chapter into a reference", () => {
    expect(readerTitle("/read/1-john/3")).toBe("1 John 3");
  });

  it("defaults to John 1", () => {
    expect(readerTitle("/read")).toBe("John 1");
  });
});

describe("adminNavItem", () => {
  it("matches the dashboard only on /admin itself", () => {
    expect(adminNavItem("/admin")?.label).toBe("Dashboard");
    expect(adminNavItem("/admin/upload")?.label).toBe("Upload music");
  });

  it("matches nested pages to their section", () => {
    expect(adminNavItem("/admin/library/abc")?.label).toBe("Track library");
  });
});
