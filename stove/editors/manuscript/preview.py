# Must be a better place to put this

from stove.editors.collaboration.revisions import autosave_manuscript_revision

from .forms import authors, featured_media, metadata
from .submission import process_submitted_page


def prepare_preview(page, submitted_data, user, revision=None):
    errors = {}

    if revision is not None:
        page = revision.as_object()
        metadata_form = metadata.create_form(page)
        authors_form = authors.create_form(page)
        featured_media_form = featured_media.create_form(page)
    else:
        errors, metadata_form, authors_form, featured_media_form = process_submitted_page(page, submitted_data, preview=True)
        autosave_manuscript_revision(page.id, submitted_data, user)

    return page, errors, metadata_form, authors_form, featured_media_form
