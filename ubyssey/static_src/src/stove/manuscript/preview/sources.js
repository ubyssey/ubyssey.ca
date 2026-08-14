// Grabs data from directly editable sources within preview
// There's a bigger comment below on how this actually works

import { topLevelBlockInfoByIdOrIndex } from "../stream/index.jsx";
import { manuscriptSession } from "../session.js";
import { ARTICLE_BLOCK_SELECTOR } from "./constants.js";

// Resolves directly editable preview element to backing Node for streamfield content, page/featured media fields resolve to form inputs
// The backing node is what is used for writeback in persistence.js
export function directEditableSource(target, { allowPage = true } = {}) {
  const instance = manuscriptSession.streamEditors.find((item) => item.fieldName === target.dataset.articleEditableStreamField);
  const articleBlock = target.closest?.(ARTICLE_BLOCK_SELECTOR);
  const paths = editablePaths(target);
  const block = instance && articleBlock && paths.length && topLevelBlockInfoByIdOrIndex(instance.doc, articleBlock.dataset.streamBlockId, Number(articleBlock.dataset.streamBlockIndex));
  const field = block && paths.map((path) => editableFieldInfo(block, path)).find(Boolean);
  const streamSource = field && {
    kind: "stream",
    instance,
    blockId: block.node.attrs?.id,
    blockIndex: block.index,
    path: field.path,
    field,
    // Makes sure custom RichText actions only happen in preview RichText Blocks
    manuscriptRichText: Boolean(block.node.attrs?.blockType === "richtext" && field.node.attrs?.manuscriptOwned && samePath(field.path, [])),
  };
  const pageFieldName = target.dataset.articleEditablePageField;
  const featuredMediaFieldName = target.dataset.articleEditableFeaturedMediaField;
  const form = (allowPage && document.querySelector("[data-manuscript-form]")) || null;
  const pageInput = formInput(form, pageFieldName);
  const featuredMediaInput = formInput(form, featuredMediaFieldName && `featured_media-${featuredMediaFieldName}`);
  const inputSource = (pageInput && { kind: "page", input: pageInput }) || (featuredMediaInput && { kind: "featured_media", input: featuredMediaInput });
  return (streamSource && (!inputSource || streamSource.field.textContent.trim())) ? streamSource : inputSource || streamSource;
}

function formInput(form, name) {
  if (!form || !name) return null;
  return form.elements?.namedItem(name) || Element.prototype.querySelector.call(form, `[name="${window.CSS.escape(name)}"]`);
}

// reads data-* attributes from preview and converts to paths pointing to wagtail block value
/*
Example, given this

{
  "headline": "Example headline",
  "image": {
    "alt_text": "A person standing outside"
  },
  "gallery": [
    {
      "caption": "First image"
    }
  ]
}

editable paths here (you use periods between keys) are
headline
image.alt_text

also numeric components use numbers like
gallery.0.caption

so for editable headline, you need
<h3 
  data-article-editable-stream-field="content"
  data-article-editable-path="headline">
  {{ block.value.headline }}
</h3>

you also need an ancestor which identifies which streamfield block it belongs to ie

<section
  data-article-block
  data-stream-field="content"
  data-stream-block-id="{{ block.id }}"
  data-stream-block-index="{{ block_index }}">
  <h3
    data-article-editable-stream-field="content"
    data-article-editable-path="headline">
    {{ block.value.headline }}
  </h3>
</section>

there are also extra ones like

data-article-editable-featured-media-field
data-article-editable-mode="richtext"

I'll move this to a higher level README at some point
*/
function editablePaths(target) {
  if (target.dataset.articleEditablePath === undefined) return [];

  const prefixes = [];
  let element = target.parentElement;
  while (element) {
    if (element.dataset?.articleEditablePathPrefix !== undefined) {
      prefixes.unshift(parseEditablePath(element.dataset.articleEditablePathPrefix));
    }
    element = element.parentElement;
  }

  const prefixPath = prefixes.reduce((parts, prefix) => parts.concat(prefix), []);
  return target.dataset.articleEditablePath.split("|").map((path) => [
    ...prefixPath,
    ...parseEditablePath(path),
  ]);
}

function parseEditablePath(path) {
  return path === "" ? [] : path.split(".").map((part) => /^\d+$/.test(part) ? Number(part) : part);
}

function editableFieldInfo(block, path) {
  const match = editableFieldInfoInNode(block.node, path);
  return match && {
    ...match,
    pos: block.start + 1 + match.pos,
  };
}

function editableFieldInfoInNode(parent, targetPath, pathPrefix = [], startPos = 0) {
  let offset = 0;

  for (let index = 0; index < parent.childCount; index += 1) {
    const node = parent.child(index);
    const pos = startPos + offset;

    if (node.type.name === "editable_field") {
      const path = pathPrefix.concat(node.attrs?.path || []);
      if (samePath(path, targetPath)) return { node, path, pos, textContent: node.textContent || "" };
    } else if (node.type.name === "list_field") {
      const match = editableFieldInfoInListField(node, targetPath, pathPrefix.concat(node.attrs?.path || []), pos + 1);
      if (match) return match;
    } else if (node.childCount) {
      const match = editableFieldInfoInNode(node, targetPath, pathPrefix, pos + 1);
      if (match) return match;
    }

    offset += node.nodeSize;
  }

  return null;
}

function editableFieldInfoInListField(listField, targetPath, listPath, startPos) {
  let offset = 0;

  for (let index = 0; index < listField.childCount; index += 1) {
    const item = listField.child(index);
    const itemPos = startPos + offset;
    const itemPath = listPath.concat(index);
    const match = editableFieldInfoInNode(item, targetPath, itemPath, itemPos + 1);
    if (match) return match;
    offset += item.nodeSize;
  }

  return null;
}

export function samePath(left = [], right = []) {
  return JSON.stringify(left || []) === JSON.stringify(right || []);
}

export function currentEditableField(source, doc = source.instance.doc) {
  const block = topLevelBlockInfoByIdOrIndex(doc, source.blockId, source.blockIndex);
  return block && editableFieldInfo(block, source.path || []);
}

// Returns Yjs editable-field type
export function sharedFieldType(source) {
  return source.instance.fieldType(source.blockId, source.path || []);
}
