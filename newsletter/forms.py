#newsletter/forms.py
from django import forms
from .models import Subscriber
from bootstrap_modal_forms.forms import BSModalModelForm

class SubscriberForm(BSModalModelForm):
    """
    Allows the creation of Email Subscribe form submittable without navigating to a user

    Depends on django-bootstrap-modal-forms==2.0.0
    """
    class Meta:
        """
        Based on tutorial found at: https://realpython.com/django-and-ajax-form-submissions/
        """
        model = Subscriber
        fields = ['email']
        # widgets = {
        #     'text' : forms.TextInput(attrs={
        #         'id': 'post-subscriber',
        #         'required': True,
        #         'placeholder': 'Your email...'
        #     }),
        # }