from dbtemplates.models import Template as DBTemplate
from wagtail.contrib.modeladmin.options import (
    ModelAdmin, modeladmin_register)
from wagtailmodelchooser import register_model_chooser

register_model_chooser(DBTemplate)

class DBTemplateAdmin(ModelAdmin):
    model = DBTemplate
    menu_label = 'Custom HTML'
    menu_icon = 'code'
    menu_order = 800
    list_display = ('name','id','creation_date','last_changed')
modeladmin_register(DBTemplateAdmin)