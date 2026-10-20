import { expect, test } from "@playwright/test";
import { E2E_ADMIN_EMAIL } from "../../playwright.config";
import { signInAs } from "./session";

const player = (page: import("@playwright/test").Page) => page.getByRole("contentinfo");

test.describe("listener shell", () => {
  test("reader shows the player and its reference in the header", async ({ page }) => {
    await page.goto("/read/john/1");
    await expect(page.getByRole("heading", { name: "John 1", level: 1 })).toBeVisible();
    await expect(player(page)).toBeVisible();
    await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
  });

  test("home and memorize choice have no player", async ({ page }) => {
    for (const path of ["/", "/memorize"]) {
      await page.goto(path);
      await expect(player(page)).toBeHidden();
    }
  });

  test("Read redirects to John 1", async ({ page }) => {
    await page.goto("/read");
    await expect(page).toHaveURL(/\/read\/john\/1$/);
  });

  test("memorize choice links to both methods", async ({ page }) => {
    await page.goto("/memorize");
    await page.getByRole("link", { name: /Memorization Steps/ }).click();
    await expect(page).toHaveURL(/\/memorize\/steps$/);
  });
});

test.describe("desktop", () => {
  test.skip(({ isMobile }) => isMobile, "desktop layout");

  test("sidebar highlights the current section", async ({ page }) => {
    await page.goto("/memorize/steps");
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav.getByRole("link", { name: "Memorize", exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.getByRole("complementary", { name: "Passage settings" })).toBeVisible();
  });

  test("admin has its own sidebar", async ({ page, context }) => {
    await signInAs(context, E2E_ADMIN_EMAIL);
    await page.goto("/admin/upload");
    const nav = page.getByRole("navigation", { name: "Admin" });
    await expect(nav.getByRole("link", { name: "Upload music" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});

test.describe("phone", () => {
  test.skip(({ isMobile }) => !isMobile, "phone layout");

  test("sidebar and right panel are hidden", async ({ page }) => {
    await page.goto("/read/john/1");
    await expect(page.getByRole("navigation", { name: "Main" })).toBeHidden();
    await expect(page.getByRole("complementary", { name: "Memorize" })).toBeHidden();
  });

  test("home shows only the settings gear in the header", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Settings" })).toBeVisible();
    await expect(page.getByRole("button", { name: "More" })).toBeHidden();
  });
});
