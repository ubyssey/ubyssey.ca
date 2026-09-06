import { useState, useEffect } from "react";

import "prosemirror-view/style/prosemirror.css";
import { EditorState } from "prosemirror-state";
import { history } from 'prosemirror-history'
import { Schema } from 'prosemirror-model'
import { toggleMark, joinBackward } from 'prosemirror-commands'
import { undo, redo } from 'prosemirror-history'
import { baseKeymap } from 'prosemirror-commands'
import { keymap } from 'prosemirror-keymap'
import { marks } from 'prosemirror-schema-basic'
import { DOMParser } from "prosemirror-model";
import { autolink } from "prosemirror-autolink";
import { Tooltip } from 'react-tooltip';

import {
  ProseMirror,
  ProseMirrorDoc,
  reactKeys,
} from "@handlewithcare/react-prosemirror";

const doc = {
  content: 'block+',
  toDOM: () => ['article', 0],
}

const text = {
  group: 'inline',
}

const paragraph = {
  content: 'inline*',
  group: 'block',
  parseDOM: [{ tag: 'p' }],
  toDOM: () => ['p', 0],
}

const schema = new Schema({
  nodes: { doc, text, paragraph },
  marks: marks,
})

export default function RichTextEditor({onBlurCallback, defaultText}) {
  const domElement = new window.DOMParser().parseFromString(defaultText, "text/html").body;
  const defaultNode = DOMParser.fromSchema(schema).parse(domElement);

  const [editorState, setEditorState] = useState(
    EditorState.create({
        doc: defaultNode,
        schema,
        plugins: [
          // The reactKeys plugin is required for the ProseMirror component to work!
          reactKeys(),
          history(),
          keymap({
            ...baseKeymap,
            'Mod-z': undo,
            'Shift-Mod-z': redo,
            Backspace: joinBackward,
            'Mod-b': toggleMark(schema.marks.strong),
            'Mod-i': toggleMark(schema.marks.em)
          }),
          ...autolink({
            openOnClick: true,
            enableEnterTrigger: true,
            excludedTrailingChars: ['.', ',', '!', '?', ':', ';', ')', ']', '}']
          })
        ],
      })
  )

  useEffect(() => {
    const newState = editorState;
    newState.doc=defaultNode;
    setEditorState(newState);
  }, [defaultText]);
  

    return (
    <ProseMirror
      state={editorState}
      dispatchTransaction={(tr) => {
        setEditorState((s) => s.apply(tr));
      }}
    >
      <div className="edit-field--richtext-editor">
        
      <ProseMirrorDoc 
        onBlur={onBlurCallback}
        style={{
          backgroundColor: "#fdfdfd",
          padding: "10px",
          paddingBottom: "0",
          minHeight: "6lh"
        }}
        />
        <div className="edit-field--richtext-help"><a data-tooltip-id="richtext-info">?</a></div>
        <Tooltip
          id={"richtext-info"}
          place={'top-end'}
          style={{ 
            backgroundColor: "#f6f6f6", 
            fontSize: "small", 
            color: "black", 
            width: "200px", 
            filter: 'drop-shadow(0px 4px 8px rgba(0, 0, 0, 0.2))'
          }}
        >
          <span><strong>Shortcuts</strong></span>
          <ul>
            <li><strong>Bold</strong>. Cmd/Ctrl + B</li>
            <li><i>Italics</i>. Cmd/Ctrl + I</li>
            <li><a href="ubyssey.ca">Link</a>. Paste a link from your clipboard using Cmd/Ctrl + V</li>
          </ul>
        </Tooltip>
        </div>
        
    </ProseMirror>
  );
}