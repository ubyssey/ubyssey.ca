/**
 * tiptap-wagtail-widget.jsx
 *
 * Google Docs-style TipTap editor mounted inside the Wagtail admin.
 * Finds every <textarea class="js-tiptap-admin-field">, hides it, and
 * replaces it with a React-based editor that syncs HTML back to the textarea.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useEditor, EditorContent } from '@tiptap/react';

// StarterKit v3 bundles: Bold, Italic, Underline, Strike, Link,
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

// ─── SVG icon library ─────────────────────────────────────────────────────────

const PATHS = {
  undo:            'M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z',
  redo:            'M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z',
  bold:            'M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z',
  italic:          'M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z',
  underline:       'M12 17c3.31 0 6-2.69 6-6V3h-2.5v8c0 1.93-1.57 3.5-3.5 3.5S8.5 12.93 8.5 11V3H6v8c0 3.31 2.69 6 6 6zm-7 2v2h14v-2H5z',
  strike:          'M7.24 8.75c-.26-.48-.39-1.03-.39-1.67 0-.61.13-1.16.4-1.67.26-.5.63-.93 1.11-1.29.48-.35 1.05-.63 1.7-.82.66-.18 1.39-.28 2.18-.28.81 0 1.54.11 2.21.34.66.22 1.23.54 1.69.94.47.4.83.88 1.08 1.43.25.55.38 1.15.38 1.81h-3.01c0-.31-.05-.59-.15-.85-.09-.27-.24-.49-.44-.68-.2-.19-.45-.33-.75-.44-.3-.1-.66-.16-1.06-.16-.39 0-.74.04-1.03.13-.29.09-.53.21-.72.36-.19.16-.34.34-.44.55-.1.21-.15.43-.15.66 0 .48.25.88.74 1.21.38.25.77.48 1.41.7H7.39c-.21-.34-.54-.89-.54-1.92zM21 12v-2H3v2h9.62c1.15.45 1.96.75 1.96 1.97 0 1-.81 1.67-2.28 1.67-1.54 0-2.93-.54-3.02-2.02H6.28c.06 3.53 3.35 4.83 6.09 4.83 1.31 0 2.7-.32 3.47-1 .68-.6 1.36-1.55 1.36-2.86 0-.56-.1-1.04-.27-1.44H21v-.15z',
  color:           'M11 3L5.5 17h2.25l1.12-3h6.25l1.12 3h2.25L13 3h-2zm-1.38 9L12 5.67 14.38 12H9.62zM3 20h18v-2H3v2z',
  highlight:       'M17.75 7L14 3.25l-10 10 1.06 4.03L9.09 19l9-9 .41.44-.75 3.31 1.94.44.97-4.28L17.75 7zM6.91 15.83l-.85-3.15L12 6.75 15.25 10l-5.96 5.96-2.38-.13z',
  clearFormat:     'M3.27 5L2 6.27l6.97 6.97L6.5 19h3l1.57-3.66L16.73 21 18 19.73 3.27 5zM6 5v.18L8.82 8h2.4l-.72 1.68 2.1 2.1L14.21 8H20V5H6z',
  superscript:     'M22 7h-2v1h3v1h-4V7c0-.55.45-1 1-1h2V5h-3V4h3c.55 0 1 .45 1 1v1c0 .55-.45 1-1 1zm-9.01 5.99L15.5 9H14l-2 3-2-3H8.5l2.51 3.99L8.5 17H10l2-3 2 3h1.5l-2.51-4.01z',
  subscript:       'M22 18h-2v1h3v1h-4v-2c0-.55.45-1 1-1h2v-1h-3v-1h3c.55 0 1 .45 1 1v1c0 .55-.45 1-1 1zm-9.01-5.01L15.5 9H14l-2 3-2-3H8.5l2.51 3.99L8.5 17H10l2-3 2 3h1.5l-2.51-4.01z',
  alignLeft:       'M15 15H3v2h12v-2zm0-8H3v2h12V7zM3 13h18v-2H3v2zm0 8h18v-2H3v2zM3 3v2h18V3H3z',
  alignCenter:     'M7 15v2h10v-2H7zm-4 6h18v-2H3v2zm0-8h18v-2H3v2zm4-6v2h10V7H7zM3 3v2h18V3H3z',
  alignRight:      'M3 21h18v-2H3v2zm6-4h12v-2H9v2zm-6-4h18v-2H3v2zm6-4h12V7H9v2zM3 3v2h18V3H3z',
  alignJustify:    'M3 21h18v-2H3v2zm0-4h18v-2H3v2zm0-4h18v-2H3v2zm0-4h18V7H3v2zm0-6v2h18V3H3z',
  bulletList:      'M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z',
  orderedList:     'M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm1-9h1V4H2v1h1v3zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 10.9V10H2v1zm5-6v2h14V5H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z',
  taskList:        'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM17.99 9l-1.41-1.42-6.59 6.59-2.58-2.57-1.42 1.41 4 3.99z',
  indent:          'M3 21h18v-2H3v2zm0-10v8l4-4-4-4zm8 9h10v-2H11v2zM3 3v2h18V3H3zm8 6h10V7H11v2zm0 4h10v-2H11v2z',
  outdent:         'M11 17h10v-2H11v2zm-8-5l4 4V8l-4 4zm0 9h18v-2H3v2zM3 3v2h18V3H3zm8 6h10V7H11v2zm0 4h10v-2H11v2z',
  link:            'M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1 0 1.71-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z',
  image:           'M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z',
  table:           'M20 2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM8 20H4v-4h4v4zm0-6H4v-4h4v4zm0-6H4V4h4v4zm6 12h-4v-4h4v4zm0-6h-4v-4h4v4zm0-6h-4V4h4v4zm6 12h-4v-4h4v4zm0-6h-4v-4h4v4zm0-6h-4V4h4v4z',
  blockquote:      'M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z',
  hr:              'M19 13H5v-2h14v2z',
  trash:           'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
  chevronDown:     'M7 10l5 5 5-5z',
  paintFormat:     'M18 4H6c-1.1 0-2 .9-2 2v2.5c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z',
};

function Icon({ name, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

// ─── Toolbar primitives ───────────────────────────────────────────────────────

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
  return <span className="tt-sep" aria-hidden="true" />;
}

// ─── Dropdown ────────────────────────────────────────────────────────────────

function Dropdown({ label, title, iconName, children, wide }) {
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
    <div className={`tt-dropdown${wide ? ' tt-dropdown--wide' : ''}`} ref={ref}>
      <button
        type="button"
        title={title}
        className="tt-dropdown__trigger"
        onClick={() => setOpen((o) => !o)}
      >
        {iconName && <Icon name={iconName} size={16} />}
        {label && <span className="tt-dropdown__label">{label}</span>}
        <Icon name="chevronDown" size={16} />
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
      {active && <span className="tt-dropdown__check">✓</span>}
      {children}
    </button>
  );
}

// ─── Color swatch picker ─────────────────────────────────────────────────────

const TEXT_COLORS = [
  '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#ffffff',
  '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff', '#9900ff',
  '#ff00ff', '#e6b8a2', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#cfe2f3',
  '#ead1dc', '#c9daf8', '#b4a7d6', '#a2c4c9', '#a4c2f4',
];
const HIGHLIGHT_COLORS = [
  '#ffff00', '#00ff00', '#00ffff', '#ff00ff', '#ff0000', '#ff9900',
  '#c9daf8', '#d9ead3', '#fce5cd', '#fff2cc', '#ead1dc', '#f4cccc',
];

function ColorPicker({ colors, onSelect, title }) {
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
    <div className="tt-color-picker" ref={ref} title={title}>
      <button type="button" className="tt-color-picker__trigger" onClick={() => setOpen(o => !o)}>
        {title === 'Text color' ? <Icon name="color" size={16} /> : <Icon name="highlight" size={16} />}
        <Icon name="chevronDown" size={14} />
      </button>
      {open && (
        <div className="tt-color-picker__menu">
          <div className="tt-color-picker__grid">
            {colors.map(c => (
              <button
                key={c}
                type="button"
                className="tt-color-picker__swatch"
                style={{ background: c }}
                title={c}
                onClick={() => { onSelect(c); setOpen(false); }}
              />
            ))}
          </div>
          <label className="tt-color-picker__custom">
            Custom:
            <input type="color" onChange={(e) => { onSelect(e.target.value); setOpen(false); }} />
          </label>
        </div>
      )}
    </div>
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
    <div className="tt-dialog">
      <div className="tt-dialog__header">
        <span>Insert link</span>
        <button type="button" className="tt-dialog__close" onClick={onClose}>✕</button>
      </div>
      <div className="tt-dialog__body">
        <input
          autoFocus
          type="url"
          placeholder="https://example.com"
          value={href}
          className="tt-dialog__input"
          onChange={(e) => setHref(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') apply(); if (e.key === 'Escape') onClose(); }}
        />
      </div>
      <div className="tt-dialog__footer">
        <button type="button" className="tt-dialog__btn tt-dialog__btn--primary" onClick={apply}>
          {href.trim() ? 'Apply' : 'Remove link'}
        </button>
        {existing && (
          <button type="button" className="tt-dialog__btn" onClick={() => { editor.chain().focus().unsetLink().run(); onClose(); }}>
            Remove
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Image dialog ─────────────────────────────────────────────────────────────

function ImageDialog({ editor, onClose }) {
  const [src, setSrc] = useState('');
  const [alt, setAlt] = useState('');

  function insert() {
    if (src.trim()) editor.chain().focus().setImage({ src: src.trim(), alt: alt.trim() }).run();
    onClose();
  }

  return (
    <div className="tt-dialog">
      <div className="tt-dialog__header">
        <span>Insert image</span>
        <button type="button" className="tt-dialog__close" onClick={onClose}>✕</button>
      </div>
      <div className="tt-dialog__body">
        <input
          autoFocus type="url" placeholder="Image URL…" value={src}
          className="tt-dialog__input"
          onChange={(e) => setSrc(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') insert(); if (e.key === 'Escape') onClose(); }}
        />
        <input
          type="text" placeholder="Alt text (optional)" value={alt}
          className="tt-dialog__input"
          onChange={(e) => setAlt(e.target.value)}
        />
      </div>
      <div className="tt-dialog__footer">
        <button type="button" className="tt-dialog__btn tt-dialog__btn--primary" onClick={insert}>Insert</button>
      </div>
    </div>
  );
}

// ─── Table grid picker ────────────────────────────────────────────────────────

function TablePicker({ onPick }) {
  const [hover, setHover] = useState([0, 0]);
  const COLS = 8, ROWS = 8;
  return (
    <div className="tt-table-picker">
      <div className="tt-table-picker__label">
        {hover[0] && hover[1] ? `${hover[0]} × ${hover[1]}` : 'Insert table'}
      </div>
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

// ─── Heading label ────────────────────────────────────────────────────────────

function headingLabel(editor) {
  for (let level = 1; level <= 6; level++) {
    if (editor.isActive('heading', { level })) return `Heading ${level}`;
  }
  if (editor.isActive('codeBlock')) return 'Code block';
  return 'Normal text';
}

// ─── Word count ───────────────────────────────────────────────────────────────

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

// ─── Toolbar ──────────────────────────────────────────────────────────────────

function Toolbar({ editor, onLinkClick, onImageClick }) {
  if (!editor) return null;

  const FONTS = [
    { label: 'Default', value: null },
    { label: 'Arial', value: 'Arial' },
    { label: 'Georgia', value: 'Georgia' },
    { label: 'Courier New', value: 'Courier New' },
    { label: 'Times New Roman', value: 'Times New Roman' },
    { label: 'Trebuchet MS', value: 'Trebuchet MS' },
    { label: 'Verdana', value: 'Verdana' },
  ];
  const currentFont = editor.getAttributes('textStyle').fontFamily || 'Default';

  return (
    <div className="tt-toolbar" role="toolbar" aria-label="Formatting toolbar">

      {/* History */}
      <Btn title="Undo (Ctrl+Z)" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>
        <Icon name="undo" />
      </Btn>
      <Btn title="Redo (Ctrl+Y)" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>
        <Icon name="redo" />
      </Btn>
      <Sep />

      {/* Text style */}
      <Dropdown label={headingLabel(editor)} title="Text style" wide>
        <DropItem active={editor.isActive('paragraph')} onClick={() => editor.chain().focus().setParagraph().run()}>
          <span className="tt-style-label tt-style-label--p">Normal text</span>
        </DropItem>
        {[1, 2, 3, 4].map(level => (
          <DropItem key={level} active={editor.isActive('heading', { level })}
            onClick={() => editor.chain().focus().toggleHeading({ level }).run()}>
            <span className={`tt-style-label tt-style-label--h${level}`}>Heading {level}</span>
          </DropItem>
        ))}
        <DropItem active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
          <span className="tt-style-label tt-style-label--code">Code block</span>
        </DropItem>
      </Dropdown>

      {/* Font family */}
      <Dropdown label={currentFont} title="Font family">
        {FONTS.map(({ label, value }) => (
          <DropItem key={label}
            active={currentFont === (value || 'Default')}
            onClick={() => value
              ? editor.chain().focus().setFontFamily(value).run()
              : editor.chain().focus().unsetFontFamily().run()
            }>
            <span style={{ fontFamily: value || 'inherit' }}>{label}</span>
          </DropItem>
        ))}
      </Dropdown>
      <Sep />

      {/* Inline marks */}
      <Btn title="Bold (Ctrl+B)" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Icon name="bold" />
      </Btn>
      <Btn title="Italic (Ctrl+I)" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Icon name="italic" />
      </Btn>
      <Btn title="Underline (Ctrl+U)" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <Icon name="underline" />
      </Btn>
      <Btn title="Strikethrough" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <Icon name="strike" />
      </Btn>
      <Sep />

      {/* Color */}
      <ColorPicker
        title="Text color"
        colors={TEXT_COLORS}
        onSelect={(c) => editor.chain().focus().setColor(c).run()}
      />
      <ColorPicker
        title="Highlight color"
        colors={HIGHLIGHT_COLORS}
        onSelect={(c) => editor.chain().focus().setHighlight({ color: c }).run()}
      />
      <Btn title="Clear formatting" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>
        <Icon name="clearFormat" />
      </Btn>
      <Sep />

      {/* Superscript / subscript */}
      <Btn title="Superscript" active={editor.isActive('superscript')} onClick={() => editor.chain().focus().toggleSuperscript().run()}>
        <Icon name="superscript" />
      </Btn>
      <Btn title="Subscript" active={editor.isActive('subscript')} onClick={() => editor.chain().focus().toggleSubscript().run()}>
        <Icon name="subscript" />
      </Btn>
      <Sep />

      {/* Alignment */}
      <Btn title="Align left" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}>
        <Icon name="alignLeft" />
      </Btn>
      <Btn title="Align center" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}>
        <Icon name="alignCenter" />
      </Btn>
      <Btn title="Align right" active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}>
        <Icon name="alignRight" />
      </Btn>
      <Btn title="Justify" active={editor.isActive({ textAlign: 'justify' })} onClick={() => editor.chain().focus().setTextAlign('justify').run()}>
        <Icon name="alignJustify" />
      </Btn>
      <Sep />

      {/* Lists */}
      <Btn title="Bullet list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <Icon name="bulletList" />
      </Btn>
      <Btn title="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <Icon name="orderedList" />
      </Btn>
      <Btn title="Task list (checklist)" active={editor.isActive('taskList')} onClick={() => editor.chain().focus().toggleTaskList().run()}>
        <Icon name="taskList" />
      </Btn>
      <Btn title="Increase indent" onClick={() => editor.chain().focus().sinkListItem('listItem').run()} disabled={!editor.can().sinkListItem('listItem')}>
        <Icon name="indent" />
      </Btn>
      <Btn title="Decrease indent" onClick={() => editor.chain().focus().liftListItem('listItem').run()} disabled={!editor.can().liftListItem('listItem')}>
        <Icon name="outdent" />
      </Btn>
      <Sep />

      {/* Insert */}
      <Btn title="Insert link (Ctrl+K)" active={editor.isActive('link')} onClick={onLinkClick}>
        <Icon name="link" />
      </Btn>
      <Btn title="Insert image" onClick={onImageClick}>
        <Icon name="image" />
      </Btn>
      <Dropdown title="Insert table" iconName="table">
        <TablePicker onPick={(rows, cols) =>
          editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run()
        } />
      </Dropdown>
      <Btn title="Blockquote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <Icon name="blockquote" />
      </Btn>
      <Btn title="Horizontal rule" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        <Icon name="hr" />
      </Btn>

      {/* Table controls (context-sensitive) */}
      {editor.isActive('table') && (
        <>
          <Sep />
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
            <DropItem onClick={() => editor.chain().focus().toggleHeaderRow().run()}>Toggle header row</DropItem>
          </Dropdown>
          <Btn title="Delete table" onClick={() => editor.chain().focus().deleteTable().run()}>
            <Icon name="trash" size={16} />
          </Btn>
        </>
      )}
    </div>
  );
}

// ─── Bubble menu (appears on text selection, custom — BubbleMenu was removed from @tiptap/react v3) ────

function InlineBubbleMenu({ editor, onLinkClick }) {
  const [pos, setPos] = useState(null);

  useEffect(() => {
    if (!editor) return;
    const update = () => {
      const { from, to } = editor.state.selection;
      const hasText = from !== to && !editor.isActive('image');
      if (!hasText) { setPos(null); return; }
      const domRange = editor.view.domAtPos(from);
      if (!domRange.node) { setPos(null); return; }
      try {
        const range = document.createRange();
        range.setStart(domRange.node, domRange.offset);
        const toPos = editor.view.domAtPos(to);
        range.setEnd(toPos.node, toPos.offset);
        const rect = range.getBoundingClientRect();
        const editorRect = editor.view.dom.closest('.tt-editor-wrap')?.getBoundingClientRect() || { top: 0, left: 0 };
        setPos({
          top: rect.top - editorRect.top - 46,
          left: Math.max(0, rect.left - editorRect.left + rect.width / 2),
        });
      } catch { setPos(null); }
    };
    editor.on('selectionUpdate', update);
    editor.on('blur', () => setPos(null));
    return () => { editor.off('selectionUpdate', update); editor.off('blur', () => setPos(null)); };
  }, [editor]);

  if (!editor || !pos) return null;

  return (
    <div
      className="tt-bubble"
      style={{ position: 'absolute', top: pos.top, left: pos.left, transform: 'translateX(-50%)', zIndex: 100 }}
      onMouseDown={e => e.preventDefault()}
    >
      <Btn title="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Icon name="bold" size={14} />
      </Btn>
      <Btn title="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Icon name="italic" size={14} />
      </Btn>
      <Btn title="Underline" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <Icon name="underline" size={14} />
      </Btn>
      <Btn title="Strikethrough" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <Icon name="strike" size={14} />
      </Btn>
      <span className="tt-bubble__sep" />
      <Btn title="Link" active={editor.isActive('link')} onClick={onLinkClick}>
        <Icon name="link" size={14} />
      </Btn>
    </div>
  );
}

// ─── Full editor component ────────────────────────────────────────────────────

function TipTapAdminEditor({ textarea }) {
  const [showLink, setShowLink] = useState(false);
  const [showImage, setShowImage] = useState(false);
  const initialContent = textarea.value.trim() || '';

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: { openOnClick: false } }),
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
          node.type.name === 'heading' ? 'Heading…' : 'Start writing…',
      }),
    ],
    content: initialContent,
    onUpdate({ editor }) {
      textarea.value = editor.getHTML();
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    },
  });

  return (
    <div className="tt-editor-wrap">
      <Toolbar editor={editor} onLinkClick={() => setShowLink(true)} onImageClick={() => setShowImage(true)} />

      {showLink && editor && (
        <div className="tt-dialog-overlay" onClick={(e) => e.target === e.currentTarget && setShowLink(false)}>
          <LinkDialog editor={editor} onClose={() => setShowLink(false)} />
        </div>
      )}
      {showImage && editor && (
        <div className="tt-dialog-overlay" onClick={(e) => e.target === e.currentTarget && setShowImage(false)}>
          <ImageDialog editor={editor} onClose={() => setShowImage(false)} />
        </div>
      )}

      <div className="tt-page-area" style={{ position: 'relative' }}>
        <InlineBubbleMenu editor={editor} onLinkClick={() => setShowLink(true)} />
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
