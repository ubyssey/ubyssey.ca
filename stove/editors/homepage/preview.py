from ..manuscript.submission import process_editor_forms


# Builds temporary preview page
def prepare_homepage_preview(page, submitted_data, revision=None):
    if revision is not None:
        page = revision.as_object()
        errors = {}
    else:
        errors, *_ = process_editor_forms(page, submitted_data, preview=True)

    return page, errors, None, None, None
