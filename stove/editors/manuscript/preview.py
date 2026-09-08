from .forms import authors, featured_media, metadata
from .submission import process_submitted_page


# Builds temporary preview page
def prepare_preview(page, submitted_data, revision=None):
    errors = {}

    if revision is not None:
        page = revision.as_object()
        metadata_form = metadata.create_form(page)
        authors_form = authors.create_form(page)
        featured_media_form = featured_media.create_form(page)
    else:
        errors, metadata_form, authors_form, featured_media_form = process_submitted_page(page, submitted_data, preview=True)

    return page, errors, metadata_form, authors_form, featured_media_form
