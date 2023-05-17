from django import forms
from dispatch.models import Person

from wagtail.users.forms import UserEditForm, UserCreationForm

class DispatchUserEditForm(UserEditForm):
    """
    See: https://docs.wagtail.io/en/v2.10/advanced_topics/customisation/custom_user_models.html
    """
    person = forms.ModelChoiceField(queryset=Person.objects, required=True, label="Who are you?")
    is_active = forms.BooleanField(required=False)

class DispatchUserCreationForm(UserCreationForm):
    """
    See: https://docs.wagtail.io/en/v2.10/advanced_topics/customisation/custom_user_models.html
    """
    person = forms.ModelChoiceField(queryset=Person.objects, required=True, label="Who are you?")
    is_active = forms.BooleanField(required=False)
