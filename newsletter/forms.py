#newsletter/forms.py

from .models import Subscriber
from bootstrap_modal_forms.forms import BSModalModelForm

class SubscriberForm(BSModalModelForm):
    """
    Allows the creation of Email Subscribe form submittable without navigating to a user

    Depends on django-bootstrap-modal-forms==2.0.0
    """
    class Meta:
        model = Subscriber
        fields = ['email']