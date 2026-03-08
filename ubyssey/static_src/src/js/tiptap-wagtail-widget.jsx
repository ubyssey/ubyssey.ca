/**
 * tiptap-wagtail-widget.jsx
 *
 * Full Google-Docs-style TipTap editor mounted inside the Wagtail admin.
 * Finds every <textarea class="js-tiptap-admin-field">, hides it, and
 * replaces it with a React-based editor that syncs JSON back to the textarea
 * so Wagtail's normal form submit picks it up.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react';

// StarterKit v3 already bundles: Bold, Italic, Underline, Strike, Link,
// Blockquote, Code, CodeBlock, Heading, HardBreak, HorizontalRule,
// BulletList, OrderedList, ListItem, Document, Paragraph, Text,
// Dropcursor, Gapcursor, UndoRedo — do NOT import those separately.
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import FontFamily from '@tiptap/extension-font-family';
import Image from '@tiptap/extension-image';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Typography from '@tiptap/extension-typography';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import CharacterCount from '@tiptap/extension-character-count';
import Placeholder from '@tiptap/extension-placeholder';

// ─── Reusable toolbar primitives ────────────────────────────────────────────

function Btn({ title, active, disabled, onClick, children }) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`tt-btn${active ? ' tt-btn--active' : ''}${disabled ? ' tt-btn--disabled' : ''}`}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <span className="tt-sep" />;
}

// ─── Dropdowns ───────────────────────────────────────────────────────────────

function Dropdown({ label, title, children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="tt-dropdown" ref={ref}>
      <button
        type="button"
        title={title}
        className="tt-dropdown__trigger"
        onClick={() => setOpen((o) => !o)}
      >
        {label} <span className="tt-dropdown__caret">▾</span>
      </button>
      {open && (
        <div className="tt-dropdown__menu" onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  );
}

function DropItem({ onClick, active, children }) {
  return (
    <button
      type="button"
      className={`tt-dropdown__item${active ? ' tt-dropdown__item--active' : ''}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

// ─── Link dialog ─────────────────────────────────────────────────────────────

function LinkDialog({ editor, onClose }) {
  const existing = editor.getAttributes('link').href || '';
  const [href, setHref] = useState(existing);

  function apply() {
    if (!href.trim()) {
      editor.chain().focus().unsetLink().run();
    } else {
      editor.chain().focus().setLink({ href: href.trim(), target: '_blank' }).run();
    }
    onClose();
  }

  return (
    <div className="tt-link-dialog">
      <input
        autoFocus
        type="url"
        placeholder="https://…"
        value={href}
        onChange={(e) => setHref(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') apply(); if (e.key === 'Escape') onClose(); }}
      />
      <button type="button" onClick={apply}>Apply</button>
      {existing && (
        <button type="button" onClick={() => { editor.chain().focus().unsetLink().run(); onClose(); }}>
          Remove
        </button>
      )}
    </div>
  );
}

// ─── Table grid picker ────────────────────────────────────────────────────────

function TablePicker({ onPick }) {
  const [hover, setHover] = useState([0, 0]);
  const COLS = 8, ROWS = 8;
  return (
    <div className="tt-table-picker">
      <div className="tt-table-picker__label">{hover[0]}×{hover[1]}</div>
      <div className="tt-table-picker__grid">
        {Array.from({ length: ROWS }, (_, r) =>
          Array.from({ length: COLS }, (_, c) => (
            <div
              key={`${r}-${c}`}
              className={`tt-table-picker__cell${r < hover[0] && c < hover[1] ? ' tt-table-picker__cell--active' : ''}`}
              onMouseEnter={() => setHover([r + 1, c + 1])}
              onClick={() => onPick(r + 1, c + 1)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Image URL dialog ─────────────────────────────────────────────────────────

function ImageDialog({ editor, onClose }) {
  const [src, setSrc] = useState('');
  const [alt, setAlt] = useState('');
  function insert() {
    if (src.trim()) editor.chain().focus().setImage({ src: src.trim(), alt: alt.trim() }).run();
    onClose();
  }
  return (
    <div className="tt-link-dialog">
      <input autoFocus type="url" placeholder="Image URL…" value={src} onChange={(e) => setSrc(e.target.value)} />
      <input type="text" placeholder="Alt text (optional)" value={alt} onChange={(e) => setAlt(e.target.value)} />
      <button type="button" onClick={insert}>Insert</button>
    </div>
  );
}

// ─── Heading label helper ─────────────────────────────────────────────────────

function currentHeadingLabel(editor) {
  for (let level = 1; level <= 6; level++) {
    if (editor.isActive('heading', { level })) return `Heading ${level}`;
  }
  if (editor.isActive('codeBlock')) return 'Code block';
  return 'Normal text';
}

// ─── Word / character counter ─────────────────────────────────────────────────

function WordCount({ editor }) {
  if (!editor) return null;
  const words = editor.storage.characterCount?.words() ?? 0;
  const chars = editor.storage.characterCount?.characters() ?? 0;
  return (
    <div className="tt-word-count">
      {words.toLocaleString()} words · {chars.toLocaleString()} characters
    </div>
  );
}

// ─── Main toolbar ─────────────────────────────────────────────────────────────

function Toolbar({ editor, setShowLink, setShowImage }) {
  if (!editor) return null;

  const FONTS = ['Default', 'Georgia', 'Arial', 'Courier New', 'Times New Roman', 'Trebuchet MS', 'Verdana'];
  const currentFont = editor.getAttributes('textStyle').fontFamily || 'Default';

  return (
    <div className="tt-toolbar">
      {/* History */}
      <Btn title="Undo (Ctrl+Z)" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>↩</Btn>
      <Btn title="Redo (Ctrl+Y)" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>↪</Btn>
      <Sep />

      {/* Heading style */}
      <Dropdown label={currentHeadingLabel(editor)} title="Text style">
        <DropItem active={editor.isActive('paragraph')} onClick={() => editor.chain().focus().setParagraph().run()}>
          <span style={{ fontSize: '1rem' }}>Normal text</span>
        </DropItem>
        {[1, 2, 3, 4, 5, 6].map((level) => (
          <DropItem
            key={level}
            active={editor.isActive('heading', { level })}
            onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
          >
            <span style={{ fontSize: `${1.6 - level * 0.1}rem`, fontWeight: 700 }}>Heading {level}</span>
          </DropItem>
        ))}
        <DropItem active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
          <span style={{ fontFamily: 'monospace' }}>Code block</span>
        </DropItem>
      </Dropdown>

      {/* Font family */}
      <Dropdown label={currentFont} title="Font">
        {FONTS.map((f) => (
          <DropItem
            key={f}
            active={currentFont === (f === 'Default' ? undefined : f)}
            onClick={() =>
              f === 'Default'
                ? editor.chain().focus().unsetFontFamily().run()
                : editor.chain().focus().setFontFamily(f).run()
            }
          >
            <span style={{ fontFamily: f === 'Default' ? 'inherit' : f }}>{f}</span>
          </DropItem>
        ))}
      </Dropdown>
      <Sep />

      {/* Inline formatting */}
      <Btn title="Bold (Ctrl+B)" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><b>B</b></Btn>
      <Btn title="Italic (Ctrl+I)" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><i>I</i></Btn>
      <Btn title="Underline (Ctrl+U)" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><u>U</u></Btn>
      <Btn title="Strikethrough" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}><s>S</s></Btn>
      <Sep />

      {/* Color / highlight */}
      <span className="tt-color-wrap" title="Text colour">
        <span className="tt-color-icon">A</span>
        <input
          type="color"
          className="tt-color-input"
          title="Text colour"
          defaultValue="#000000"
          onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
        />
      </span>
      <span className="tt-color-wrap" title="Highlight colour">
        <span className="tt-color-icon tt-color-icon--highlight">H</span>
        <input
          type="color"
          className="tt-color-input"
          title="Highlight colour"
          defaultValue="#ffff00"
          onChange={(e) => editor.chain().focus().setHighlight({ color: e.target.value }).run()}
        />
      </span>
      <Btn title="Clear formatting" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>✕</Btn>
      <Sep />

      {/* Superscript / subscript */}
      <Btn title="Superscript" active={editor.isActive('superscript')} onClick={() => editor.chain().focus().toggleSuperscript().run()}>x²</Btn>
      <Btn title="Subscript" active={editor.isActive('subscript')} onClick={() => editor.chain().focus().toggleSubscript().run()}>x₂</Btn>
      <Sep />

      {/* Alignment */}
      <Btn title="Align left" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}>⬤◻◻</Btn>
      <Btn title="Align center" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}>◻⬤◻</Btn>
      <Btn title="Align right" active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}>◻◻⬤</Btn>
      <Btn title="Justify" active={editor.isActive({ textAlign: 'justify' })} onClick={() => editor.chain().focus().setTextAlign('justify').run()}>⬤⬤⬤</Btn>
      <Sep />

      {/* Lists */}
      <Btn title="Bullet list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>• —</Btn>
      <Btn title="Ordered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. —</Btn>
      <Btn title="Task list" active={editor.isActive('taskList')} onClick={() => editor.chain().focus().toggleTaskList().run()}>☑ —</Btn>
      <Btn title="Indent" onClick={() => editor.chain().focus().sinkListItem('listItem').run()} disabled={!editor.can().sinkListItem('listItem')}>→</Btn>
      <Btn title="Outdent" onClick={() => editor.chain().focus().liftListItem('listItem').run()} disabled={!editor.can().liftListItem('listItem')}>←</Btn>
      <Sep />

      {/* Insert */}
      <Btn title="Insert link" active={editor.isActive('link')} onClick={() => setShowLink(true)}>🔗</Btn>
      <Btn title="Insert image" onClick={() => setShowImage(true)}>🖼</Btn>
      <Dropdown label="Table" title="Insert table">
        <TablePicker onPick={(rows, cols) => {
          editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
        }} />
      </Dropdown>
      <Sep />

      {/* Table actions (only when cursor is inside a table) */}
      {editor.isActive('table') && (
        <>
          <Dropdown label="Row" title="Table row actions">
            <DropItem onClick={() => editor.chain().focus().addRowBefore().run()}>Add row above</DropItem>
            <DropItem onClick={() => editor.chain().focus().addRowAfter().run()}>Add row below</DropItem>
            <DropItem onClick={() => editor.chain().focus().deleteRow().run()}>Delete row</DropItem>
          </Dropdown>
          <Dropdown label="Column" title="Table column actions">
            <DropItem onClick={() => editor.chain().focus().addColumnBefore().run()}>Add column before</DropItem>
            <DropItem onClick={() => editor.chain().focus().addColumnAfter().run()}>Add column after</DropItem>
            <DropItem onClick={() => editor.chain().focus().deleteColumn().run()}>Delete column</DropItem>
          </Dropdown>
          <Dropdown label="Cell" title="Table cell actions">
            <DropItem onClick={() => editor.chain().focus().mergeCells().run()}>Merge cells</DropItem>
            <DropItem onClick={() => editor.chain().focus().splitCell().run()}>Split cell</DropItem>
            <DropItem onClick={() => editor.chain().focus().toggleHeaderColumn().run()}>Toggle header column</DropItem>
            <DropItem onClick={() => editor.chain().focus().toggleHeaderRow().run()}>Toggle header row</DropItem>
          </Dropdown>
          <Btn title="Delete table" onClick={() => editor.chain().focus().deleteTable().run()}>🗑 Table</Btn>
          <Sep />
        </>
      )}

      {/* Misc */}
      <Btn title="Blockquote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>" "</Btn>
      <Btn title="Horizontal rule" onClick={() => editor.chain().focus().setHorizontalRule().run()}>—</Btn>
    </div>
  );
}

// ─── Full editor component ────────────────────────────────────────────────────

function TipTapAdminEditor({ textarea }) {
  const [showLink, setShowLink] = useState(false);
  const [showImage, setShowImage] = useState(false);

  let initialContent = {};
  try {
    const raw = textarea.value.trim();
    if (raw && raw !== '{}') initialContent = JSON.parse(raw);
  } catch (_) {}

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Link is bundled in StarterKit v3 — configure it here instead of importing separately
        link: { openOnClick: false },
      }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Subscript,
      Superscript,
      FontFamily,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Image,
      TaskList,
      TaskItem.configure({ nested: true }),
      Typography,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      CharacterCount,
      Placeholder.configure({
        placeholder: ({ node }) =>
          node.type.name === 'heading'
            ? 'Heading…'
            : 'Start writing… (Markdown shortcuts work: ## Heading, **bold**, - list)',
      }),
    ],
    content: Object.keys(initialContent).length ? initialContent : '',
    onUpdate({ editor }) {
      textarea.value = JSON.stringify(editor.getJSON());
    },
  });

  return (
    <div className="tt-editor-wrap">
      <Toolbar editor={editor} setShowLink={setShowLink} setShowImage={setShowImage} />

      {showLink && editor && (
        <div className="tt-dialog-overlay">
          <LinkDialog editor={editor} onClose={() => setShowLink(false)} />
        </div>
      )}
      {showImage && editor && (
        <div className="tt-dialog-overlay">
          <ImageDialog editor={editor} onClose={() => setShowImage(false)} />
        </div>
      )}

      <div className="tt-page-area">
        <EditorContent editor={editor} className="tt-document" />
      </div>

      <div className="tt-footer">
        <WordCount editor={editor} />
      </div>
    </div>
  );
}

// ─── Mount ────────────────────────────────────────────────────────────────────

function mountEditor(textarea) {
  const container = document.createElement('div');
  container.className = 'tt-mount';
  textarea.parentNode.insertBefore(container, textarea.nextSibling);
  createRoot(container).render(<TipTapAdminEditor textarea={textarea} />);
}

function initAll() {
  document.querySelectorAll('textarea.js-tiptap-admin-field').forEach((el) => {
    if (!el.dataset.tiptapMounted) {
      el.dataset.tiptapMounted = '1';
      mountEditor(el);
    }
  });
}

document.addEventListener('DOMContentLoaded', initAll);

const observer = new MutationObserver(initAll);
document.addEventListener('DOMContentLoaded', () => {
  observer.observe(document.body, { childList: true, subtree: true });
});
