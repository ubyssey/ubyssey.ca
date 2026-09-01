# Builds the page-metadata form (modelform of page model with only the fields we want to edit in the editor)

from django import forms
from django.core.exceptions import FieldDoesNotExist
from wagtail.fields import RichTextField, StreamField

# todo: add headers or something to make settings cleaner

# Settings fields
PAGE_FORM_FIELDS = (
    "fw_alternate_title",
    "lede",
    "seo_description",
    "timeliness",
    "slug",
    "deadline",
    "explicit_published_at",
    "show_last_modified",
)

# If we want to hide fields in settings, but still have them editable (we need this for them to be saved)
PAGE_FORM_HIDDEN_FIELDS = (
    "title",
    "title_tag",
    "disclaimer",
)

PAGE_FORM_LABELS = {
    "fw_alternate_title": "Alternate Title",
    "lede": "Lede",
    "timeliness": "Timeliness",
    "slug": "Slug",
    "title_tag": "Title Tag",
    "seo_description": "Meta Description",
    "explicit_published_at": "Publication Date",
    "show_last_modified": "Show last modified",
}

def create_form(page, data=None):
    form_class = get_page_form_class(page.__class__)
    return form_class(data=data, instance=page) if data is not None else form_class(instance=page)


def apply_form(page, form, user=None):
    for field_name, value in form.cleaned_data.items():
        setattr(page, field_name, value)


# We create a custom form class based on the specific page model, but we filter for only the fields above
def get_page_form_class(model):
    names = get_page_field_names(model)
    widgets = {
        name: forms.Textarea
        for name in names
        if isinstance(model._meta.get_field(name), RichTextField)
    }
    return forms.modelform_factory(model, fields=names, widgets=widgets, labels=PAGE_FORM_LABELS)


def get_page_field_names(page):
    return [name for name in (*PAGE_FORM_HIDDEN_FIELDS, *PAGE_FORM_FIELDS) if is_page_form_field(page, name)]


def is_page_form_field(page, name):
    try:
        field = page._meta.get_field(name)
    except FieldDoesNotExist:
        return False

    if isinstance(field, StreamField) or field.is_relation:
        return False

    return field.editable and field.concrete and field.formfield() is not None
