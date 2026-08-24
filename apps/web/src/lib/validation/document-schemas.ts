import { z } from "zod";

/** Relative doc path, e.g. "notes/ideas.md". */
export const docPathSchema = z
  .string()
  .min(1)
  .max(500)
  .refine((p) => !p.includes("..") && !p.startsWith("/"), {
    message: "Path must be relative and may not contain '..'",
  });

export const createDocumentSchema = z.object({
  parentPath: docPathSchema.catch(""),
  name: z.string().trim().min(1).max(200),
  kind: z.enum(["file", "dir"]),
});

export const saveDocumentSchema = z.object({
  path: docPathSchema,
  content: z.string().max(5_000_000),
});

export const renameDocumentSchema = z.object({
  path: docPathSchema,
  newPath: docPathSchema,
});
