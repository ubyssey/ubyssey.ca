from django.db import models
from wagtail.fields import RichTextField
from wagtail.admin.panels import (
    FieldPanel,
    MultiFieldPanel,
)
from wagtail.contrib.settings.models import (
    BaseGenericSetting,
    register_setting,
)

@register_setting
class JoinPopupSettings(BaseGenericSetting):
    preview_text = RichTextField()
    
    popup_title = models.CharField(max_length=255)
    popup_text = RichTextField()
    
    active = models.BooleanField(default=True)
    show_on_first_view = models.BooleanField(default=True)
    days_between_appearing = models.IntegerField(default=7)
    seconds_delay_before_appearing = models.IntegerField(default=90)

    panels = [
        FieldPanel('preview_text'),
        FieldPanel('popup_title'),
        FieldPanel('popup_text'),
        FieldPanel('active'),
        FieldPanel('show_on_first_view'),
        FieldPanel('days_between_appearing'),
        FieldPanel('seconds_delay_before_appearing'),
    ]