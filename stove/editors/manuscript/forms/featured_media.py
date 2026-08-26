# Featured media (the media displayed at top of the article page)

from django import forms

# Currently hiding video, we have youtube as an alternative
# todo: render captions properly within settings, also add featured media tab
FEATURED_MEDIA_FIELDS = ("image", "caption", "credit", "alt_text")
FEATURED_MEDIA_LABELS = {
    "image": "Image",
    "alt_text": "Alt text",
}


class FeaturedMediaForm(forms.ModelForm):
    image = forms.ModelChoiceField(
        queryset=None,
        required=False,
        label=FEATURED_MEDIA_LABELS["image"],
    )

    def __init__(self, *args, **kwargs):
        page = kwargs.pop("page")
        super().__init__(*args, **kwargs)
        image_model = self._meta.model._meta.get_field("image").remote_field.model
        article_media = getattr(page, "article_media", None)
        ids = list(
            article_media.model.objects.filter(
                article_page_id=page.pk, image_id__isnull=False
            ).values_list("image_id", flat=True)
        ) if article_media else []

        if self.instance.image_id:
            ids.append(self.instance.image_id)
        self.fields["image"].queryset = image_model.objects.filter(id__in=ids)
        self.fields["image"].initial = self.instance.image_id
        self.fields["image"].empty_label = "Add Images in Media Tab"


# Some pages don't have featured media, so sometimes returns None
def create_form(page, data=None):
    manager = getattr(page, "featured_media", None)
    model = getattr(manager, "model", None)
    if not manager or not model:
        return None

    form_class = get_featured_media_form_class(model)
    instance = manager.first() or model(**{featured_media_parent_field(model): page, "sort_order": 0})
    kwargs = {"instance": instance, "prefix": "featured_media", "page": page}
    if data is not None:
        kwargs["data"] = data
    return form_class(**kwargs)


def apply_form(page, form, user=None):
    manager = page.featured_media

    if not any(form.cleaned_data.get(name) for name in FEATURED_MEDIA_FIELDS):
        manager.clear()
        return

    items = list(manager.all())
    item = form.save(commit=False)
    setattr(item, featured_media_parent_field(item.__class__), page)
    item.sort_order = items[0].sort_order if items else 0

    manager.set([item] + items[1:] if items else [item])


# Creates a form class depending on the article page's featured media model
def get_featured_media_form_class(model):
    return forms.modelform_factory(
        model,
        form=FeaturedMediaForm,
        fields=FEATURED_MEDIA_FIELDS,
        widgets={"caption": forms.Textarea(attrs={"rows": 1})},
        labels=FEATURED_MEDIA_LABELS,
    )



# Finds the parent page type, so doesn't break if not basic article page
def featured_media_parent_field(model):
    return next(
        field.name
        for field in model._meta.fields
        if getattr(getattr(field, "remote_field", None), "related_name", None) == "featured_media"
    )
