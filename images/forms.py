from wagtail.images.forms import BaseImageForm
from wagtail.admin.widgets import AdminPageChooser
from wagtail.admin.staticfiles import versioned_static
from django import forms

class AdminPageChooserWithModalWorkflowScript(AdminPageChooser):
    '''
    The wagtail image editor does not have the modal-workflow.js script
    AdminPageChooser assumes that this script is loaded.
    Since it isn't, we have to include it in the scripts added by the page chooser
    '''
    @property
    def media(self):
        modal_workflow_script = forms.Media(
            js=[
                versioned_static("wagtailadmin/js/modal-workflow.js")
            ]
        )
        return super().media + modal_workflow_script

class UbysseyImageForm(BaseImageForm):
    '''
    By default the author field input is a dropdown of every author. This sucks. So we changed it using the page chooser modal
    '''
    class Meta(BaseImageForm.Meta):
        widgets = BaseImageForm.Meta.widgets
        widgets["author"] = AdminPageChooserWithModalWorkflowScript(target_models=["authors.AuthorPage"])
