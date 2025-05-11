from wagtail.images.forms import BaseImageForm
from wagtail.admin.widgets import BaseChooser
from wagtail.admin.staticfiles import versioned_static
from django import forms

class ImagesAuthorChooser(BaseChooser):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.model = "authors.AuthorPage"
        self.icon = 'user'
        self.chooser_modal_url_name = "author_chooser:choose"

    @property
    def media(self):
        '''
        The wagtail image editor does not have the modal-workflow.js script
        AdminPageChooser assumes that this script is loaded.
        Since it isn't, we have to include it in the scripts added by the page chooser
        '''
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
        widgets["author"] = ImagesAuthorChooser()
