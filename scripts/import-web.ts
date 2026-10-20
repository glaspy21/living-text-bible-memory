/**
 * One-off import of the World English Bible (public domain) from ebible.org's USFM download.
 *
 *   curl-free usage:  npx tsx scripts/import-web.ts <folder with the *.usfm files>
 *
 * Writes one JSON file per book to src/server/scripture/web-data/<slug>.json, shaped as
 * chapters → [verse number, text]. The USFM files themselves are not kept in the repo.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BOOKS } from "../src/shared/scripture/books";
import { parseUsfm, toChapterArrays } from "../src/shared/scripture/usfm";

// USFM book codes in canonical order, so index i is BOOKS[i].
const USFM_CODES =
  "GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ISA JER LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV".split(
    " ",
  );

const source = process.argv[2];
if (!source) {
  console.error("Usage: npx tsx scripts/import-web.ts <folder with the USFM files>");
  process.exit(1);
}

const out = join(__dirname, "../src/server/scripture/web-data");
mkdirSync(out, { recursive: true });
const files = readdirSync(source);

let verses = 0;
BOOKS.forEach((book, i) => {
  const code = USFM_CODES[i];
  const file = files.find((f) => new RegExp(`^\\d+-${code}eng-web\\.usfm$`).test(f));
  if (!file) throw new Error(`No USFM file for ${book.name} (${code})`);

  const chapters = toChapterArrays(parseUsfm(readFileSync(join(source, file), "utf8")));
  if (chapters.length !== book.chapterCount) {
    throw new Error(
      `${book.name}: expected ${book.chapterCount} chapters, found ${chapters.length}`,
    );
  }
  verses += chapters.reduce((n, c) => n + c.length, 0);
  const compact = chapters.map((c) => c.map((v) => [v.verse, v.text]));
  writeFileSync(join(out, `${book.slug}.json`), JSON.stringify(compact));
});
console.log(`Wrote ${BOOKS.length} books, ${verses} verses to ${out}`);
