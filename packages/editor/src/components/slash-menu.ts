import { Extension } from "@tiptap/core";
import Suggestion, {
  type SuggestionProps,
  type SuggestionKeyDownProps,
} from "@tiptap/suggestion";
import type { Editor, Range } from "@tiptap/core";

export interface SlashMenuItem {
  id: string;
  label: string;
  hint: string;
  /** Insert the item's content at the trigger range. */
  apply: (editor: Editor, range: Range) => void;
}

/** Build the slash command list. One function, one job: define the menu. */
export function getSlashItems(): SlashMenuItem[] {
  return [
    {
      id: "h1",
      label: "Heading 1",
      hint: "Big section heading",
      apply: (editor, range) =>
        editor.chain().focus().deleteRange(range).setNode("heading", { level: 1 }).run(),
    },
    {
      id: "h2",
      label: "Heading 2",
      hint: "Medium section heading",
      apply: (editor, range) =>
        editor.chain().focus().deleteRange(range).setNode("heading", { level: 2 }).run(),
    },
    {
      id: "h3",
      label: "Heading 3",
      hint: "Small section heading",
      apply: (editor, range) =>
        editor.chain().focus().deleteRange(range).setNode("heading", { level: 3 }).run(),
    },
    {
      id: "bulletList",
      label: "Bullet list",
      hint: "Simple bulleted list",
      apply: (editor, range) =>
        editor.chain().focus().deleteRange(range).toggleBulletList().run(),
    },
    {
      id: "orderedList",
      label: "Numbered list",
      hint: "Ordered list",
      apply: (editor, range) =>
        editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
    },
    {
      id: "taskList",
      label: "Task list",
      hint: "Track action items",
      apply: (editor, range) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertContent({
            type: "taskItem",
            attrs: { checked: false },
            content: [{ type: "paragraph" }],
          })
          .run();
      },
    },
    {
      id: "quote",
      label: "Quote",
      hint: "Capture a quotation",
      apply: (editor, range) =>
        editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
    },
    {
      id: "code",
      label: "Code block",
      hint: "Fenced code with highlighting",
      apply: (editor, range) =>
        editor.chain().focus().deleteRange(range).setCodeBlock({ language: "ts" }).run(),
    },
    {
      id: "divider",
      label: "Divider",
      hint: "Horizontal rule",
      apply: (editor, range) =>
        editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
    },
    {
      id: "table",
      label: "Table",
      hint: "3×3 table",
      apply: (editor, range) =>
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
          .run(),
    },
    {
      id: "mermaid",
      label: "Mermaid diagram",
      hint: "Flowcharts, sequence diagrams…",
      apply: (editor, range) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertContent({
            type: "mermaidBlock",
            content: [{ type: "text", text: "graph TD\n    A[Start] --> B[End]" }],
          })
          .run();
      },
    },
    {
      id: "math",
      label: "Math block",
      hint: "LaTeX display equation",
      apply: (editor, range) =>
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertContent({ type: "blockMath", attrs: { latex: "E = mc^2" } })
          .run(),
    },
    {
      id: "image",
      label: "Image",
      hint: "Embed from URL",
      apply: (editor, range) => {
        const url = window.prompt("Image URL");
        if (!url) return;
        editor.chain().focus().deleteRange(range).setImage({ src: url }).run();
      },
    },
  ];
}

/** Filter items by typed query. */
function filterItems(query: string): SlashMenuItem[] {
  const q = query.toLowerCase();
  return getSlashItems().filter(
    (item) => item.label.toLowerCase().includes(q) || item.id.includes(q)
  );
}

interface PopupHandle {
  root: HTMLElement;
  list: HTMLUListElement;
}

interface PopupState extends PopupHandle {
  props: SuggestionProps<SlashMenuItem>;
  selectedIndex: number;
}

/** Create and attach the popup DOM element. One job: DOM. */
function createPopup(): PopupHandle {
  const root = document.createElement("div");
  root.className = "md-slash-menu";
  const list = document.createElement("ul");
  root.appendChild(list);
  document.body.appendChild(root);
  return { root, list };
}

/** Render menu items into the popup list. One job: items. */
function renderItems(popup: PopupState): void {
  const { props, list } = popup;
  list.innerHTML = "";

  props.items.forEach((item, index) => {
    const li = document.createElement("li");
    li.className = `md-slash-item${index === popup.selectedIndex ? " active" : ""}`;
    const label = document.createElement("span");
    label.className = "md-slash-label";
    label.textContent = item.label;
    const hint = document.createElement("span");
    hint.className = "md-slash-hint";
    hint.textContent = item.hint;
    li.append(label, hint);
    li.addEventListener("mousedown", (e) => {
      e.preventDefault();
      item.apply(props.editor, props.range);
    });
    list.appendChild(li);
  });

  if (props.items.length === 0) {
    const empty = document.createElement("li");
    empty.className = "md-slash-empty";
    empty.textContent = "No commands";
    list.appendChild(empty);
  }

  const rect = props.clientRect?.();
  if (rect) {
    popup.root.style.left = `${rect.left}px`;
    popup.root.style.top = `${rect.bottom + 6}px`;
  }
  popup.root.style.display = "block";
}

/**
 * "/" slash-command menu backed by @tiptap/suggestion.
 */
export const SlashMenu = Extension.create({
  name: "slashMenu",

  addProseMirrorPlugins() {
    let popup: PopupState | null = null;

    const destroyPopup = () => {
      if (popup) popup.root.remove();
      popup = null;
    };

    return [
      Suggestion<SlashMenuItem>({
        editor: this.editor,
        char: "/",
        startOfLine: false,
        items: ({ query }) => filterItems(query),
        command: ({ editor, range, props: item }) => item.apply(editor, range),
        render: () => ({
          onStart: (props) => {
            destroyPopup();
            popup = { ...createPopup(), props, selectedIndex: 0 };
            renderItems(popup);
          },
          onUpdate: (props) => {
            if (!popup) popup = { ...createPopup(), props, selectedIndex: 0 };
            else popup.props = props;
            // Reset selection when the filtered list shrinks past it.
            if (popup.selectedIndex >= props.items.length) popup.selectedIndex = 0;
            renderItems(popup);
          },
          onKeyDown: ({ event }: SuggestionKeyDownProps) => {
            if (!popup) return false;

            if (event.key === "Escape") {
              destroyPopup();
              return true;
            }
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              const count = popup.props.items.length;
              if (count > 0) {
                const delta = event.key === "ArrowDown" ? 1 : -1;
                popup.selectedIndex = (popup.selectedIndex + delta + count) % count;
                renderItems(popup);
              }
              return true;
            }
            if (event.key === "Enter") {
              const item = popup.props.items[popup.selectedIndex];
              if (item) item.apply(popup.props.editor, popup.props.range);
              destroyPopup();
              return true;
            }
            return false;
          },
          onExit: () => destroyPopup(),
        }),
      }),
    ];
  },
});
