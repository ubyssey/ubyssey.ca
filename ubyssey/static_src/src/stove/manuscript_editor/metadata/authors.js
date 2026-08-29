import * as Y from "yjs";

// Shared authors are stored in a Y.Array of Y.Maps, each map containing an authorId and role

export function newSharedAuthor(row) {
  const author = new Y.Map();
  author.set("authorId", row.authorId || "");
  author.set("role", row.role || "author");
  return author;
}

export function newSharedAuthors(rows) {
  const authors = new Y.Array();
  if (rows.length) authors.insert(0, rows.map(newSharedAuthor));
  return authors;
}

export function updateSharedAuthors(metadata, authors, rows) {
  metadata.doc.transact(() => {
    const sharedRows = authors.toArray();
    const commonLength = Math.min(sharedRows.length, rows.length);
    for (let index = 0; index < commonLength; index += 1) {
      const sharedRow = sharedRows[index];
      if (sharedRow instanceof Y.Map) {
        sharedRow.set("authorId", rows[index].authorId || "");
        sharedRow.set("role", rows[index].role || "author");
      } else {
        authors.delete(index, 1);
        authors.insert(index, [newSharedAuthor(rows[index])]);
      }
    }
    if (authors.length > rows.length) authors.delete(rows.length, authors.length - rows.length);
    if (rows.length > authors.length) authors.insert(authors.length, rows.slice(authors.length).map(newSharedAuthor));
  }, "metadata-authors");
}

export function authorRows(form) {
  return Array.from(form.querySelectorAll("[data-article-author-row]"), (row) => ({
    authorId: row.querySelector("[name='article_authors-author']")?.value || "",
    role: row.querySelector("[name='article_authors-role']")?.value || "author",
  }));
}
