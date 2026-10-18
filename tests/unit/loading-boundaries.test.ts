import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Voir src/app/(app)/loading.tsx : une frontière de chargement par segment ayant des sous-pages
// évite qu'une navigation client vers une sous-page reste en suspens.
const APP = join(process.cwd(), "src/app");
const AREAS = ["(app)", "(public)", "admin"];

function dirs(root: string): string[] {
  return [root, ...readdirSync(root).map((n) => join(root, n)).filter((p) => statSync(p).isDirectory()).flatMap(dirs)];
}
const hasSubPages = (dir: string) => dirs(dir).some((d) => d !== dir && existsSync(join(d, "page.tsx")));

describe("frontières de chargement", () => {
  it("chaque segment avec une page et des sous-pages a son loading.tsx", () => {
    const missing = AREAS.flatMap((a) => dirs(join(APP, a)))
      .filter((d) => existsSync(join(d, "page.tsx")) && hasSubPages(d) && !existsSync(join(d, "loading.tsx")))
      .map((d) => relative(APP, d));
    expect(missing).toEqual([]);
  });
});
