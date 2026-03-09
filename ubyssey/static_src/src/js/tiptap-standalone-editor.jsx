/**
 * tiptap-standalone-editor.jsx
 *
 * Full-page Google-Docs-style editor. Rendered at /tiptap-editor/ and
 * /tiptap-editor/<page_id>/.  No Wagtail admin chrome — just title,
 * lede, body, auto-save, and publish.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useEditor, EditorContent } from '@tiptap/react';

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

// ─── Utilities ────────────────────────────────────────────────────────────────

function getCsrf() {
  return window.__TIPTAP_CSRF__ ||
    (document.cookie.match(/csrftoken=([^;]+)/) || [])[1] || '';
}

const API_BASE  = window.__TIPTAP_API_BASE__  || '/admin/tiptap-editor/api/';
const LIST_URL  = window.__TIPTAP_LIST_URL__   || '/admin/tiptap-editor/';

function useDebounce(fn, delay) {
  const timer = useRef(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  return useCallback((...args) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => fnRef.current(...args), delay);
  }, [delay]);
}

// ─── Editable plain-text div (title / lede) ───────────────────────────────────

const EditableDiv = React.forwardRef(function EditableDiv(
  { className, placeholder, initialValue, onChange, onEnter },
  ref,
) {
  const innerRef = useRef();
  const resolvedRef = ref || innerRef;

  useEffect(() => {
    if (resolvedRef.current) resolvedRef.current.innerText = initialValue || '';
  }, []); // set once on mount

  return (
    <div
      ref={resolvedRef}
      contentEditable
      suppressContentEditableWarning
      className={className}
      data-placeholder={placeholder}
      onInput={(e) => onChange && onChange(e.currentTarget.innerText)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); onEnter && onEnter(); }
      }}
    />
  );
});

// ─── Toolbar primitives ───────────────────────────────────────────────────────

function Btn({ title, active, disabled, onClick, children }) {
  return (
    <button
      type="button" title={title} disabled={disabled} onClick={onClick}
      className={`tt-btn${active ? ' tt-btn--active' : ''}${disabled ? ' tt-btn--disabled' : ''}`}
    >{children}</button>
  );
}

function Sep() { return <span className="tt-sep" />; }

function Dropdown({ label, title, children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  return (
    <div className="tt-dropdown" ref={ref}>
      <button type="button" title={title} className="tt-dropdown__trigger" onClick={() => setOpen(o => !o)}>
        {label} <span className="tt-dropdown__caret">▾</span>
      </button>
      {open && <div className="tt-dropdown__menu" onClick={() => setOpen(false)}>{children}</div>}
    </div>
  );
}

function DropItem({ onClick, active, children }) {
  return (
    <button type="button" className={`tt-dropdown__item${active ? ' tt-dropdown__item--active' : ''}`} onClick={onClick}>
      {children}
    </button>
  );
}

// ─── Table grid picker ────────────────────────────────────────────────────────

function TablePicker({ onPick }) {
  const [hover, setHover] = useState([0, 0]);
  const C = 8, R = 8;
  return (
    <div className="tt-table-picker">
      <div className="tt-table-picker__label">{hover[0]}×{hover[1]}</div>
      <div className="tt-table-picker__grid">
        {Array.from({ length: R }, (_, r) =>
          Array.from({ length: C }, (_, c) => (
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

// ─── Link / Image dialogs ─────────────────────────────────────────────────────

function LinkDialog({ editor, onClose }) {
  const [href, setHref] = useState(editor.getAttributes('link').href || '');
  const apply = () => {
    if (!href.trim()) editor.chain().focus().unsetLink().run();
    else editor.chain().focus().setLink({ href: href.trim(), target: '_blank' }).run();
    onClose();
  };
  return (
    <div className="tt-dialog-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="tt-link-dialog">
        <p className="tt-link-dialog__label">Insert link</p>
        <input autoFocus type="url" placeholder="https://…" value={href} onChange={e => setHref(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') apply(); if (e.key === 'Escape') onClose(); }} />
        <div className="tt-link-dialog__actions">
          <button type="button" className="tt-link-dialog__btn tt-link-dialog__btn--primary" onClick={apply}>Apply</button>
          {editor.getAttributes('link').href && (
            <button type="button" className="tt-link-dialog__btn tt-link-dialog__btn--danger"
              onClick={() => { editor.chain().focus().unsetLink().run(); onClose(); }}>Remove</button>
          )}
          <button type="button" className="tt-link-dialog__btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function ImageDialog({ editor, onClose }) {
  const [src, setSrc] = useState('');
  const [alt, setAlt] = useState('');
  const insert = () => {
    if (src.trim()) editor.chain().focus().setImage({ src: src.trim(), alt: alt.trim() }).run();
    onClose();
  };
  return (
    <div className="tt-dialog-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="tt-link-dialog">
        <p className="tt-link-dialog__label">Insert image</p>
        <input autoFocus type="url" placeholder="Image URL…" value={src} onChange={e => setSrc(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') insert(); if (e.key === 'Escape') onClose(); }} />
        <input type="text" placeholder="Alt text (optional)" value={alt} onChange={e => setAlt(e.target.value)} />
        <div className="tt-link-dialog__actions">
          <button type="button" className="tt-link-dialog__btn tt-link-dialog__btn--primary" onClick={insert}>Insert</button>
          <button type="button" className="tt-link-dialog__btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── Toolbar ──────────────────────────────────────────────────────────────────

function headingLabel(editor) {
  for (let l = 1; l <= 6; l++) if (editor.isActive('heading', { level: l })) return `Heading ${l}`;
  if (editor.isActive('codeBlock')) return 'Code block';
  return 'Normal text';
}

const FONTS = ['Default', 'Arial', 'Georgia', 'Courier New', 'Times New Roman', 'Trebuchet MS', 'Verdana'];

function Toolbar({ editor, onLinkClick, onImageClick }) {
  if (!editor) return <div className="tts-toolbar" />;
  const font = editor.getAttributes('textStyle').fontFamily || 'Default';

  return (
    <div className="tts-toolbar">
      {/* History */}
      <Btn title="Undo (Ctrl+Z)" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>↩</Btn>
      <Btn title="Redo (Ctrl+Y)" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>↪</Btn>
      <Sep />

      {/* Text style */}
      <Dropdown label={headingLabel(editor)} title="Text style">
        <DropItem active={editor.isActive('paragraph')} onClick={() => editor.chain().focus().setParagraph().run()}>
          <span style={{ fontSize: '14px' }}>Normal text</span>
        </DropItem>
        {[1,2,3,4,5,6].map(l => (
          <DropItem key={l} active={editor.isActive('heading',{level:l})}
            onClick={() => editor.chain().focus().toggleHeading({level:l}).run()}>
            <span style={{ fontSize: `${20-l*2}px`, fontWeight: 700 }}>Heading {l}</span>
          </DropItem>
        ))}
        <DropItem active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
          <span style={{ fontFamily: 'monospace', fontSize: '13px' }}>Code block</span>
        </DropItem>
      </Dropdown>

      {/* Font family */}
      <Dropdown label={font} title="Font">
        {FONTS.map(f => (
          <DropItem key={f} active={font === f || (f === 'Default' && font === 'Default')}
            onClick={() => f === 'Default' ? editor.chain().focus().unsetFontFamily().run() : editor.chain().focus().setFontFamily(f).run()}>
            <span style={{ fontFamily: f === 'Default' ? 'inherit' : f }}>{f}</span>
          </DropItem>
        ))}
      </Dropdown>
      <Sep />

      {/* Inline marks */}
      <Btn title="Bold (Ctrl+B)" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><b>B</b></Btn>
      <Btn title="Italic (Ctrl+I)" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><i>I</i></Btn>
      <Btn title="Underline (Ctrl+U)" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><u>U</u></Btn>
      <Btn title="Strikethrough" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}><s>S</s></Btn>
      <Sep />

      {/* Colour / highlight */}
      <label className="tt-color-wrap" title="Text colour">
        <span className="tt-color-icon">A</span>
        <input type="color" className="tt-color-input" defaultValue="#000000"
          onChange={e => editor.chain().focus().setColor(e.target.value).run()} />
      </label>
      <label className="tt-color-wrap" title="Highlight colour">
        <span className="tt-color-icon tt-color-icon--highlight">H</span>
        <input type="color" className="tt-color-input" defaultValue="#ffff00"
          onChange={e => editor.chain().focus().setHighlight({ color: e.target.value }).run()} />
      </label>
      <Btn title="Clear formatting" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>✕</Btn>
      <Sep />

      {/* Super/subscript */}
      <Btn title="Superscript" active={editor.isActive('superscript')} onClick={() => editor.chain().focus().toggleSuperscript().run()}>x²</Btn>
      <Btn title="Subscript" active={editor.isActive('subscript')} onClick={() => editor.chain().focus().toggleSubscript().run()}>x₂</Btn>
      <Sep />

      {/* Alignment */}
      <Btn title="Align left"   active={editor.isActive({textAlign:'left'})}    onClick={() => editor.chain().focus().setTextAlign('left').run()}>   ≡←</Btn>
      <Btn title="Align center" active={editor.isActive({textAlign:'center'})}  onClick={() => editor.chain().focus().setTextAlign('center').run()}> ≡≡</Btn>
      <Btn title="Align right"  active={editor.isActive({textAlign:'right'})}   onClick={() => editor.chain().focus().setTextAlign('right').run()}>  →≡</Btn>
      <Btn title="Justify"      active={editor.isActive({textAlign:'justify'})} onClick={() => editor.chain().focus().setTextAlign('justify').run()}>≡≡≡</Btn>
      <Sep />

      {/* Lists */}
      <Btn title="Bullet list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>• —</Btn>
      <Btn title="Ordered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1.—</Btn>
      <Btn title="Task list" active={editor.isActive('taskList')} onClick={() => editor.chain().focus().toggleTaskList().run()}>☑ —</Btn>
      <Btn title="Increase indent" onClick={() => editor.chain().focus().sinkListItem('listItem').run()} disabled={!editor.can().sinkListItem('listItem')}>→</Btn>
      <Btn title="Decrease indent" onClick={() => editor.chain().focus().liftListItem('listItem').run()} disabled={!editor.can().liftListItem('listItem')}>←</Btn>
      <Sep />

      {/* Insert */}
      <Btn title="Insert link" active={editor.isActive('link')} onClick={onLinkClick}>🔗</Btn>
      <Btn title="Insert image" onClick={onImageClick}>🖼</Btn>
      <Dropdown label="Table" title="Insert table">
        <TablePicker onPick={(r, c) => editor.chain().focus().insertTable({ rows: r, cols: c, withHeaderRow: true }).run()} />
      </Dropdown>
      <Btn title="Blockquote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>" "</Btn>
      <Btn title="Horizontal rule" onClick={() => editor.chain().focus().setHorizontalRule().run()}>—</Btn>
      <Sep />

      {/* Contextual table actions */}
      {editor.isActive('table') && <>
        <Dropdown label="Row ▾" title="Row actions">
          <DropItem onClick={() => editor.chain().focus().addRowBefore().run()}>Add row above</DropItem>
          <DropItem onClick={() => editor.chain().focus().addRowAfter().run()}>Add row below</DropItem>
          <DropItem onClick={() => editor.chain().focus().deleteRow().run()}>Delete row</DropItem>
        </Dropdown>
        <Dropdown label="Column ▾" title="Column actions">
          <DropItem onClick={() => editor.chain().focus().addColumnBefore().run()}>Add column before</DropItem>
          <DropItem onClick={() => editor.chain().focus().addColumnAfter().run()}>Add column after</DropItem>
          <DropItem onClick={() => editor.chain().focus().deleteColumn().run()}>Delete column</DropItem>
        </Dropdown>
        <Dropdown label="Cell ▾" title="Cell actions">
          <DropItem onClick={() => editor.chain().focus().mergeCells().run()}>Merge cells</DropItem>
          <DropItem onClick={() => editor.chain().focus().splitCell().run()}>Split cell</DropItem>
          <DropItem onClick={() => editor.chain().focus().toggleHeaderRow().run()}>Toggle header row</DropItem>
          <DropItem onClick={() => editor.chain().focus().toggleHeaderColumn().run()}>Toggle header col</DropItem>
        </Dropdown>
        <Btn title="Delete table" onClick={() => editor.chain().focus().deleteTable().run()}>🗑 Table</Btn>
      </>}
    </div>
  );
}

// ─── Header bar ───────────────────────────────────────────────────────────────

const STATUS_LABEL = { idle: '', saving: 'Saving…', saved: '✓ Saved', error: '⚠ Error saving', published: '✓ Published' };

function Header({ docTitle, saveStatus, viewUrl, onPublish, onAdminLink }) {
  return (
    <div className="tts-header">
      <div className="tts-header__left">
        <a href={LIST_URL} className="tts-header__logo" title="Back to TipTap articles">
          <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" width="28" height="28">
            <rect width="32" height="32" rx="4" fill="#2e1f5e"/>
            <text x="50%" y="55%" dominantBaseline="middle" textAnchor="middle" fill="white" fontSize="18" fontWeight="bold" fontFamily="sans-serif">W</text>
          </svg>
        </a>
        <div className="tts-header__doc-title">{docTitle || 'Untitled'}</div>
      </div>
      <div className="tts-header__right">
        <span className={`tts-save-status tts-save-status--${saveStatus}`}>
          {STATUS_LABEL[saveStatus]}
        </span>
        {viewUrl && (
          <a href={viewUrl} target="_blank" rel="noopener noreferrer" className="tts-header__btn tts-header__btn--ghost">
            View live ↗
          </a>
        )}
        <button type="button" className="tts-header__btn tts-header__btn--primary" onClick={onPublish}
          disabled={saveStatus === 'saving' || !docTitle.trim()}>
          Publish
        </button>
      </div>
    </div>
  );
}

// ─── Word count footer ────────────────────────────────────────────────────────

function Footer({ editor }) {
  if (!editor) return <div className="tts-footer" />;
  const words = editor.storage.characterCount?.words() ?? 0;
  const chars = editor.storage.characterCount?.characters() ?? 0;
  return (
    <div className="tts-footer">
      <span>{words.toLocaleString()} words</span>
      <span className="tts-footer__dot">·</span>
      <span>{chars.toLocaleString()} characters</span>
    </div>
  );
}

// ─── Main standalone editor ───────────────────────────────────────────────────

function StandaloneEditor() {
  const [saveStatus, setSaveStatus] = useState('idle');
  const [viewUrl, setViewUrl] = useState(window.__TIPTAP_VIEW_URL__ || '');
  const [showLink, setShowLink] = useState(false);
  const [showImage, setShowImage] = useState(false);

  // Use refs for mutable values that need to be current inside async callbacks
  const pageIdRef = useRef(window.__TIPTAP_PAGE_ID__ || null);
  const titleRef = useRef();
  const ledeRef = useRef();
  const editorRef = useRef();

  // Synced state for header display only
  const [docTitle, setDocTitle] = useState(window.__TIPTAP_PAGE_TITLE__ || '');

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
            : 'Start writing… (Markdown shortcuts: ## Heading, **bold**, - list, > quote)',
      }),
    ],
    content: window.__TIPTAP_INITIAL_CONTENT__ || '',
    onUpdate({ editor }) {
      editorRef.current = editor;
      triggerAutoSave();
    },
  });

  useEffect(() => { editorRef.current = editor; }, [editor]);

  // ── Save helpers ────────────────────────────────────────────────────────────

  const getSaveData = () => ({
    title: titleRef.current?.innerText?.trim() || 'Untitled',
    lede: ledeRef.current?.innerText?.trim() || '',
    body: editorRef.current?.getHTML() || '',
  });

  const doSave = useCallback(async (publish = false) => {
    setSaveStatus('saving');
    try {
      const data = { ...getSaveData(), ...(publish ? { publish: true } : {}) };
      let url;
      if (!pageIdRef.current) {
        // New page — create endpoint handles publish flag too
        url = `${API_BASE}create/`;
      } else if (publish) {
        url = `${API_BASE}${pageIdRef.current}/publish/`;
      } else {
        url = `${API_BASE}${pageIdRef.current}/save/`;
      }

      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrf() },
        body: JSON.stringify(data),
      });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const result = await resp.json();

      if (!pageIdRef.current && result.page_id) {
        pageIdRef.current = result.page_id;
        window.history.replaceState({}, '', result.edit_url);
      }
      if (result.view_url) setViewUrl(result.view_url);

      setSaveStatus(publish ? 'published' : 'saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  }, []);

  const triggerAutoSave = useDebounce(() => doSave(false), 1500);

  const handleTitleChange = (text) => {
    setDocTitle(text);
    triggerAutoSave();
  };

  return (
    <div className="tts-app">
      <Header
        docTitle={docTitle}
        saveStatus={saveStatus}
        viewUrl={viewUrl}
        onPublish={() => doSave(true)}
      />

      <Toolbar
        editor={editor}
        onLinkClick={() => setShowLink(true)}
        onImageClick={() => setShowImage(true)}
      />

      <div className="tts-content">
        <div className="tts-paper">
          <EditableDiv
            ref={titleRef}
            className="tts-paper__title"
            placeholder="Untitled"
            initialValue={window.__TIPTAP_PAGE_TITLE__ || ''}
            onChange={handleTitleChange}
            onEnter={() => ledeRef.current?.focus()}
          />
          <EditableDiv
            ref={ledeRef}
            className="tts-paper__lede"
            placeholder="Add a subtitle…"
            initialValue={window.__TIPTAP_INITIAL_LEDE__ || ''}
            onChange={() => triggerAutoSave()}
          />
          <div className="tts-paper__divider" />
          <EditorContent editor={editor} className="tts-paper__body" />
        </div>
      </div>

      <Footer editor={editor} />

      {showLink && editor && <LinkDialog editor={editor} onClose={() => setShowLink(false)} />}
      {showImage && editor && <ImageDialog editor={editor} onClose={() => setShowImage(false)} />}
    </div>
  );
}

// ─── Mount ────────────────────────────────────────────────────────────────────

const rootEl = document.getElementById('tts-root');
if (rootEl) createRoot(rootEl).render(<StandaloneEditor />);
