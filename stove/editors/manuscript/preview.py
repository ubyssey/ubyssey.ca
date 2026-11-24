from .forms import authors, featured_media, metadata
from .submission import process_editor_forms


# Builds temporary preview page
def prepare_manuscript_preview(page, submitted_data, revision=None):
    errors = {}

    if revision is not None:
        # For viewing history - uses non-public version with annotation data, which is stored as editor_article_version in the revisions
        content = {**revision.content, **(revision.content.get("editor_article_version") or {})}
        # Sets the page directly as the editor_article_version json
        page = revision.content_object.with_content_json(content)
        metadata_form = metadata.create_form(page)
        authors_form = authors.create_form(page)
        featured_media_form = featured_media.create_form(page)
    else:
        # Article previews for editor
        errors, metadata_form, authors_form, featured_media_form = process_editor_forms(page, submitted_data, preview=True)

    return page, errors, metadata_form, authors_form, featured_media_form
