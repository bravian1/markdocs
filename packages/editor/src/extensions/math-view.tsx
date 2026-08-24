"use client";

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import katex from "katex";
import { useMemo, useState } from "react";

/** Render LaTeX to KaTeX HTML; returns null on failure. */
function renderLatex(latex: string, displayMode: boolean): string | null {
  if (!latex.trim()) return null;
  try {
    return katex.renderToString(latex, {
      displayMode,
      throwOnError: true,
      strict: false,
    });
  } catch {
    return null;
  }
}

interface MathBodyProps {
  latex: string;
  displayMode: boolean;
  editing: boolean;
  onCommit: (latex: string) => void;
  onCancel: () => void;
}

/**
 * Shared math body: rendered KaTeX, or a textarea while editing.
 * Commits on blur / Ctrl+Enter / Escape-to-cancel.
 */
function MathBody({ latex, displayMode, editing, onCommit, onCancel }: MathBodyProps) {
  const [draft, setDraft] = useState(latex);
  const html = useMemo(() => renderLatex(latex, displayMode), [latex, displayMode]);

  if (editing) {
    return (
      <textarea
        className="md-math-textarea"
        value={draft}
        autoFocus
        spellCheck={false}
        rows={displayMode ? Math.max(3, draft.split("\n").length) : 2}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => onCommit(draft)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
          if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
            e.preventDefault();
            onCommit(draft);
          }
        }}
      />
    );
  }

  if (html === null) {
    return (
      <span className="md-math-invalid" title="Invalid LaTeX — double-click to edit">
        {latex || "Empty math"}
      </span>
    );
  }

  /* KaTeX output is generated from the sanitized-by-construction renderer
     and contains no user-supplied raw HTML. */
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

export function InlineMathView({ node, updateAttributes }: NodeViewProps) {
  const [editing, setEditing] = useState(false);

  return (
    <NodeViewWrapper
      as="span"
      className="md-inline-math"
      data-editing={editing ? "" : undefined}
      onDoubleClick={() => setEditing(true)}
    >
      <MathBody
        latex={node.attrs.latex as string}
        displayMode={false}
        editing={editing}
        onCommit={(next) => {
          updateAttributes({ latex: next });
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    </NodeViewWrapper>
  );
}

export function BlockMathView({ node, updateAttributes }: NodeViewProps) {
  const [editing, setEditing] = useState(false);

  return (
    <NodeViewWrapper
      className="md-block-math"
      data-editing={editing ? "" : undefined}
      onDoubleClick={() => setEditing(true)}
    >
      <div className="md-block-math-body">
        <MathBody
          latex={node.attrs.latex as string}
          displayMode
          editing={editing}
          onCommit={(next) => {
            updateAttributes({ latex: next });
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      </div>
      {!editing && (
        <div className="md-math-hint" contentEditable={false}>
          double-click to edit LaTeX
        </div>
      )}
    </NodeViewWrapper>
  );
}
