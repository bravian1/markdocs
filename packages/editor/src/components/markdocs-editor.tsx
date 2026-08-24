"use client";

import {
  BubbleMenu,
  EditorContent,
  useEditor,
  type Editor,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Table from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";
import TaskItem from "@tiptap/extension-task-item";
import BulletList from "@tiptap/extension-bullet-list";
import { common, createLowlight } from "lowlight";
import { useEffect, useRef } from "react";

import { Mermaid } from "../extensions/mermaid";
import { WikiLink } from "../extensions/wiki-link";
import { InlineMath, BlockMath } from "../extensions/math";
import { SlashMenu } from "./slash-menu";
import { markdownToDocJSON } from "../markdown/parse";
import { docToMarkdown } from "../markdown/serialize";
import { Node, Slice } from "@tiptap/pm/model";
import type { Schema } from "@tiptap/pm/model";

const lowlight = createLowlight(common);

/**
 * Heuristic: does this plain-text clipboard content look like markdown that
 * deserves structured parsing? One job: detection.
 */
function looksLikeMarkdown(text: string): boolean {
  if (!text.includes("\n")) return false; // single-line text is never "markdown"
  const patterns = [
    /^#{1,6}\s+\S/m, // heading
    /^```/m, // fenced code
    /^\s*[-*+]\s\[[ xX]\]\s/m, // task list item
    /^\s*[-*+]\s\S/m, // bullet list
    /^\s*\d+\.\s\S/m, // ordered list
    /^\|.+\|\s*$/m, // table row
    /^>\s\S/m, // blockquote
    /\*\*[^*\n]+\*\*/, // bold
    /^\s*(?:[-*_]\s*){3,}$/m, // horizontal rule
    /\$\$[^$\n]+\$\$/, // math block
  ];
  return patterns.some((re) => re.test(text));
}

/**
 * Parse markdown text into a Slice for paste insertion.
 * Falls back to null so the caller can use default paste handling.
 */
function docJSONToSlice(schema: Schema, markdown: string): Slice | null {
  try {
    const doc = Node.fromJSON(schema, markdownToDocJSON(schema, markdown));
    // Normalize to an open slice so pasting mid-paragraph splits cleanly.
    return new Slice(doc.content, 1, 1);
  } catch {
    return null;
  }
}

/** Allow task items to live directly inside bullet lists (GFM style). */
const FlexibleBulletList = BulletList.extend({
  content: "(listItem | taskItem)+",
});

export interface MarkdocsEditorProps {
  /** Markdown source to load into the editor. */
  initialMarkdown: string;
  /** Called with serialized markdown on every content change. */
  onChange?: (markdown: string) => void;
  editable?: boolean;
  placeholder?: string;
  className?: string;
  /** Called when the user clicks a [[wiki link]] in the document. */
  onWikiLinkOpen?: (target: string) => void;
  /** Upload an image file; resolves to its URL. Enables paste/drop images. */
  uploadImage?: (file: File) => Promise<string>;
}

/** Assemble the full markdocs extension set. One job: extensions. */
export function buildExtensions(placeholder: string) {
  return [
    StarterKit.configure({
      bulletList: false,
      codeBlock: false, // replaced by CodeBlockLowlight
    }),
    FlexibleBulletList,
    CodeBlockLowlight.configure({ lowlight, defaultLanguage: "plaintext" }),
    Link.configure({ openOnClick: false, autolink: true }),
    Image,
    Table.configure({ resizable: false }),
    TableRow,
    TableHeader,
    TableCell,
    TaskItem.configure({ nested: true }),
    WikiLink,
    Mermaid,
    InlineMath,
    BlockMath,
    Placeholder.configure({ placeholder }),
    SlashMenu,
  ];
}

/**
 * The markdocs WYSIWYG markdown editor.
 * Loads and emits plain markdown; renders rich content client-side.
 */
export function MarkdocsEditor({
  initialMarkdown,
  onChange,
  editable = true,
  placeholder = "Start writing… press / for commands",
  className,
  onWikiLinkOpen,
  uploadImage,
}: MarkdocsEditorProps) {
  // Latest callback without re-creating the editor.
  const wikiOpenRef = useRef(onWikiLinkOpen);
  wikiOpenRef.current = onWikiLinkOpen;
  const uploadImageRef = useRef(uploadImage);
  uploadImageRef.current = uploadImage;

  /** Handle pasted/dropped image files via the upload callback. */
  async function handleDroppedFiles(
    view: Editor["view"],
    files: readonly File[],
    insertAt: number | null
  ): Promise<boolean> {
    const uploader = uploadImageRef.current;
    if (!uploader || files.length === 0) return false;

    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;
      try {
        const url = await uploader(file);
        const imageType = view.state.schema.nodes.image;
        if (!imageType) continue;
        const pos = insertAt ?? view.state.selection.from;
        view.dispatch(
          view.state.tr.replaceWith(pos, pos, imageType.create({ src: url }))
        );
      } catch (err) {
        console.error("image upload failed", err);
      }
    }
    return true;
  }
  const editor: Editor | null = useEditor({
    extensions: buildExtensions(placeholder),
    content: "",
    editable,
    immediatelyRender: false,
    onUpdate: ({ editor: current }) => {
      onChange?.(getMarkdown(current));
    },
    editorProps: {
      attributes: {
        class: "md-editor-content",
        spellcheck: "true",
      },
      handlePaste(view, event) {
        // Image paste: route through the upload callback.
        const files = Array.from(event.clipboardData?.files ?? []);
        if (files.length > 0 && files.some((f) => f.type.startsWith("image/"))) {
          void handleDroppedFiles(view, files, null);
          return true; // block default so we don't insert raw data URLs twice
        }

        // Markdown paste: when the clipboard carries plain-text markdown
        // (no useful text/html from the source app), parse it with the same
        // pipeline used for loading documents so headings, tables, fences,
        // task lists etc. survive the paste.
        const text = event.clipboardData?.getData("text/plain") ?? "";
        const html = event.clipboardData?.getData("text/html") ?? "";
        if (text && !html && looksLikeMarkdown(text)) {
          const slice = docJSONToSlice(view.state.schema, text);
          if (slice) {
            view.dispatch(view.state.tr.replaceSelection(slice));
            return true;
          }
        }
        return false;
      },
      handleDrop(view, event) {
        const files = Array.from(event.dataTransfer?.files ?? []);
        if (files.length === 0 || !files.some((f) => f.type.startsWith("image/")))
          return false;
        const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
        void handleDroppedFiles(view, files, coords?.pos ?? null);
        return true;
      },
      handleClick(view, pos) {
        try {
          const $pos = view.state.doc.resolve(pos);
          const mark = $pos.marks().find((m) => m.type.name === "wikiLink");
          if (mark) {
            wikiOpenRef.current?.(String(mark.attrs.target ?? ""));
          }
        } catch {
          /* ignore */
        }
        return false; // keep default behaviour (caret placement)
      },
    },
  });

  // Load initial markdown once the editor exists.
  useEffect(() => {
    if (!editor) return;
    const json = markdownToDocJSON(editor.schema, initialMarkdown);
    editor.commands.setContent(json, false);
  }, [editor]);

  // Follow editability changes (e.g. viewer mode).
  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  if (!editor) {
    return <div className={className ?? "md-editor"} />;
  }

  return (
    <div className={className ?? "md-editor"}>
      <EditorContent editor={editor} />
      {editable && (
        <BubbleMenu editor={editor} className="md-bubble-menu" updateDelay={100}>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={editor.isActive("bold") ? "active font-bold" : "font-bold"}
            title="Bold"
          >
            B
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`italic ${editor.isActive("italic") ? "active" : ""}`}
            title="Italic"
          >
            I
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={`line-through ${editor.isActive("strike") ? "active" : ""}`}
            title="Strikethrough"
          >
            S
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleCode().run()}
            className={`font-mono ${editor.isActive("code") ? "active" : ""}`}
            title="Inline code"
          >
            {"</>"}
          </button>
          <button
            type="button"
            onClick={() => {
              const url = window.prompt("Link URL");
              if (url !== null) {
                const chain = editor.chain().focus();
                if (url === "") {
                  chain.unsetLink().run();
                } else {
                  chain.setLink({ href: url }).run();
                }
              }
            }}
            title="Link"
          >
            Link
          </button>
        </BubbleMenu>
      )}
    </div>
  );
}

/** Serialize the editor's current document to markdown. */
export function getMarkdown(editor: Editor): string {
  return docToMarkdown(editor.state.doc);
}
