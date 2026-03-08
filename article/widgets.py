import json

from django import forms


class TipTapAdminWidget(forms.Textarea):
    """
    A Textarea whose value is TipTap JSON.  The textarea is hidden with CSS;
    a TipTap editor is mounted next to it by tiptap-wagtail-widget.jsx.
    Wagtail's standard form submission reads the (JS-kept-in-sync) textarea value
    and Django's JSONField deserialises it — no custom save API required.
    """

    def __init__(self, *args, **kwargs):
        attrs = kwargs.setdefault('attrs', {})
        attrs['class'] = (attrs.get('class', '') + ' js-tiptap-admin-field').strip()
        attrs['style'] = 'display: none'
        super().__init__(*args, **kwargs)

    def format_value(self, value):
        if value is None:
            return '{}'
        if isinstance(value, (dict, list)):
            return json.dumps(value)
        return value or '{}'

    class Media:
        js = ['ubyssey/js/tiptap-wagtail-widget.js']
        css = {'all': ['ubyssey/css/tiptap-article.css']}
