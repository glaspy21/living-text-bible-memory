import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { E2E_ADMIN_EMAIL } from "../../playwright.config";
import { streamed } from "./helpers";
import { signInAs } from "./session";

/**
 * Automated accessibility scan (axe-core, WCAG 2.0/2.1 A and AA rules) of the main screens at
 * desktop and phone width. It catches missing names, bad roles, label problems and colour
 * contrast; it does not replace trying the app with a keyboard and a screen reader.
 */
const screens = [
  { name: "Home", url: "/" },
  { name: "Reader", url: "/read/john/1" },
  { name: "Memorize choice", url: "/memorize?p=john 1:1-5" },
  { name: "Steps: Listen", url: "/memorize/steps?p=john 1:1-5&step=listen" },
  { name: "Steps: Recall", url: "/memorize/steps?p=john 1:1-5&step=recall" },
  { name: "Flashcards", url: "/memorize/flashcards?p=john 1:1-5" },
  { name: "Verse range", url: "/memorize/range?p=john 1:1-5&from=steps" },
];
const adminScreens = [
  { name: "Admin dashboard", url: "/admin" },
  { name: "Admin upload", url: "/admin/upload" },
  { name: "Admin library", url: "/admin/library" },
  { name: "Admin timing", url: "/admin/timing" },
  { name: "Admin publish", url: "/admin/publish" },
];

async function scan(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  return results.violations.map((v) => ({
    rule: v.id,
    impact: v.impact,
    help: v.help,
    targets: v.nodes.slice(0, 4).map((n) => n.target.join(" ")),
  }));
}

test.describe("accessibility scan: listener screens", () => {
  for (const { name, url } of screens) {
    test(name, async ({ page }) => {
      await page.goto(url);
      await streamed(page);
      await page.waitForTimeout(600); // entry animations settle
      expect(await scan(page)).toEqual([]);
    });
  }
});

test.describe("accessibility scan: open menus and other states", () => {
  const open = async (page: Page, url: string) => {
    await page.goto(url);
    await streamed(page);
    await page.waitForTimeout(500);
  };

  test("the book and chapter selector", async ({ page }) => {
    await open(page, "/read/john/1");
    await expect(async () => {
      await page.locator("header button[aria-haspopup='dialog']").click();
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 1000 });
    }).toPass();
    await page.waitForTimeout(400);
    expect(await scan(page)).toEqual([]);
  });

  test("the end-mode menu", async ({ page, isMobile }) => {
    test.skip(isMobile, "the player's menus are tested on desktop");
    await open(page, "/read/john/1");
    await expect(async () => {
      await page.getByRole("button", { name: /^When the verse ends:/ }).click();
      await expect(page.getByRole("menu")).toBeVisible({ timeout: 1000 });
    }).toPass();
    expect(await scan(page)).toEqual([]);
  });

  test("a flashcard turned over", async ({ page }) => {
    await open(page, "/memorize/flashcards?p=john 1:1-5");
    await page.getByTestId("card").click();
    await page.waitForTimeout(800);
    expect(await scan(page)).toEqual([]);
  });

  test("Steps: Chain with the help line open", async ({ page }) => {
    await open(page, "/memorize/steps?p=john 1:1-5&step=chain");
    await page.getByRole("button", { name: /help/i }).first().click();
    await page.waitForTimeout(400);
    expect(await scan(page)).toEqual([]);
  });
});

test.describe("accessibility scan: admin screens", () => {
  test.skip(({ isMobile }) => isMobile, "admin is desktop-only");
  for (const { name, url } of adminScreens) {
    test(name, async ({ page, context }) => {
      await signInAs(context, E2E_ADMIN_EMAIL);
      await page.goto(url);
      await streamed(page);
      await page.waitForTimeout(600);
      expect(await scan(page)).toEqual([]);
    });
  }
});
