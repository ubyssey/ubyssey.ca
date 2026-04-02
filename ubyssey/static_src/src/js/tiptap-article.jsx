/**
 * tiptap-article.jsx  —  read-only public viewer
 *
 * Renders TipTap JSON authored in the Wagtail admin as styled prose.
 * Includes all the same extensions so every node type displays correctly.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { useEditor, EditorContent } from '@tiptap/react';

// StarterKit v3 already bundles: Bold, Italic, Underline, Strike, Link,
// Blockquote, Code, CodeBlock, Heading, HardBreak, HorizontalRule,
// BulletList, OrderedList, ListItem, Document, Paragraph, Text, etc.
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

function TipTapViewer({ content }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Link is bundled in StarterKit v3 — configure it here
        link: { openOnClick: true },
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
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: content && Object.keys(content).length ? content : '',
    editable: false,
  });

  return (
    <div className="tiptap-article">
      <div className="tiptap-article__body">
        <EditorContent editor={editor} className="tiptap-article__editor" />
      </div>
    </div>
  );
}

const rootEl = document.getElementById('tiptap-article-root');
if (rootEl) {
  const content = window.__TIPTAP_INITIAL_CONTENT__ || {};
  createRoot(rootEl).render(<TipTapViewer content={content} />);
}
