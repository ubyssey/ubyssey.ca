from django import forms

from wagtail.users.forms import UserEditForm, UserCreationForm

class DispatchUserEditForm(UserEditForm):
    pass

class DispatchUserCreationForm(UserCreationForm):
    pass