from django.forms import ModelForm
from newsletter.models import Subscriber

class SubscriberForm(ModelForm):
    class Meta:
        model = Subscriber
        fields = ['email']