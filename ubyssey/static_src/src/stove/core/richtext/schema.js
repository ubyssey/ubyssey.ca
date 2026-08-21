// Extra RichText Schema

import { Schema } from "prosemirror-model";
import { addListNodes } from "prosemirror-schema-list";
import { schema as basicSchema } from "prosemirror-schema-basic";
import { commentMarkSpec, footnoteMarkSpec } from "./annotations/index.js";

export const baseNodesWithLists = addListNodes(
  basicSchema.spec.nodes,
  "paragraph block*",
  "block",
);

export const marks = basicSchema.spec.marks.append({
  underline: {
    parseDOM: [
      { tag: "u" },
      {
        style: "text-decoration",
        getAttrs: (value) => String(value).includes("underline") ? null : false,
      },
    ],
    toDOM() {
      return ["u", 0];
    },
  },
  comment: commentMarkSpec,
  footnote: footnoteMarkSpec,
});

export const richTextSchema = new Schema({
  nodes: baseNodesWithLists,
  marks,
});
