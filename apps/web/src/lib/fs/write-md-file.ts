import fs from "node:fs/promises";
import path from "node:path";

/**
 * Write content to a file, creating parent directories as needed.
 * Single job: write.
 */
export async function writeMdFile(
  absolutePath: string,
  content: string
): Promise<void> {
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, content, "utf8");
}
