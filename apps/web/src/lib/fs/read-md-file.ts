import fs from "node:fs/promises";

/** Read a markdown file's raw content. Single job: read. */
export async function readMdFile(absolutePath: string): Promise<string> {
  return fs.readFile(absolutePath, "utf8");
}
