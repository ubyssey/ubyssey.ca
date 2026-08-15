# Article media upload form

from django import forms
from taggit.models import Tag
from wagtail.documents import get_document_model
from wagtail.images import get_image_model


class ArticleMediaUploadForm(forms.Form):
    media_id = forms.IntegerField(widget=forms.HiddenInput, required=False)
    kind = forms.ChoiceField(choices=(("image", "Image"), ("document", "Document")), initial="image", required=False)
    title = forms.CharField(required=False)
    file = forms.FileField(required=False)
    author = forms.ModelChoiceField(queryset=None, required=False)
    description = forms.CharField(widget=forms.Textarea, required=False)
    tags = forms.CharField(required=False, help_text="Select one or more tags.")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        author_model = get_image_model()._meta.get_field("author").remote_field.model
        author_field = self.fields["author"]
        author_field.queryset = (
            author_model.objects.all() if self.is_bound else author_model.objects.none()
        )
        author_field.widget.attrs["data-article-media-author-select"] = ""
        if not self.is_bound:
            author_field.empty_label = "Loading authors"

    # Reject non existing tags, remove if we want to allow this (but I think we should add a media-tag adder in the content tracker or something)
    def clean_tags(self):
        tags = [tag.strip() for tag in self.cleaned_data.get("tags", "").split(",") if tag.strip()]
        existing_tags = set(Tag.objects.filter(name__in=tags).values_list("name", flat=True))
        if any(tag not in existing_tags for tag in tags):
            raise forms.ValidationError("Select pre-existing tags only.")
        return ", ".join(tags)

    def clean(self):
        cleaned = super().clean()
        is_edit = cleaned.get("media_id")
        has_anything = is_edit or any(cleaned.get(name) for name in ("title", "file", "author", "tags"))
        has_anything = has_anything or (cleaned.get("kind") == "image" and cleaned.get("description"))
        if has_anything and not cleaned.get("title"):
            self.add_error("title", "Title is required for uploads.")
        if has_anything and not is_edit and not cleaned.get("file"):
            self.add_error("file", "Choose a file to upload.")
        return cleaned


def get_article_media_upload_form(data=None, files=None):
    return ArticleMediaUploadForm(data=data, files=files, prefix="article_media")


# Refer to this - ArticleMediaOrderable - for more details
# This adds the media to the article page, but does not save it into the article
def add_article_media(page, item, is_image):
    manager = getattr(page, "article_media", None)
    model = getattr(manager, "model", None)
    if not manager or not model:
        return None

    image = item if is_image else None
    document = item if not is_image else None
    rows = list(manager.all())
    for row in rows:
        if (image and row.image_id == image.id) or (document and row.document_id == document.id):
            return row

    return model.objects.create(
        article_page=page,
        image=image,
        document=document,
        sort_order=len(rows),
    )


# Creates/Updates the media item like when you edit the title or tags for example
def save_article_media(page, form, user=None):
    data = form.cleaned_data
    is_image = data.get("kind") != "document"
    model = get_image_model() if is_image else get_document_model()
    item = model.objects.filter(id=data.get("media_id")).first() if data.get("media_id") else None

    if data.get("media_id") and not item:
        return None
    if not item and not data.get("file"):
        return None

    if not item:
        item = model()
        if user and hasattr(item, "uploaded_by_user"):
            item.uploaded_by_user = user

    item.title = data["title"]
    if data.get("file"):
        item.file = data["file"]
    if is_image:
        item.author = data.get("author")
        item.description = data.get("description") or ""

    item.save()
    item.tags.clear()
    tags = [tag.strip() for tag in (data.get("tags") or "").split(",") if tag.strip()]
    if tags:
        item.tags.add(*tags)

    return add_article_media(page, item, is_image)



def get_article_media_tag_options():
    return [
        {"value": tag.name, "label": tag.name}
        for tag in Tag.objects.all().order_by("name")
    ]
