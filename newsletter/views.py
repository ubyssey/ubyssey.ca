from django.shortcuts import render
from django.views.generic import View, TemplateView
from django.urls import reverse_lazy
from .forms import SubscriberForm
from .models import Subscriber
from bootstrap_modal_forms.generic import BSModalCreateView

# Create your views here.

class SubscriberCreateView(BSModalCreateView):
    form_class = SubscriberForm
    template_name = 'newsletter/subscribe.html'
    # success_message = 'Success! Thank you for subscribing!'
    success_url = reverse_lazy('success')
    
class SuccessView(TemplateView):
    template_name = 'newsletter/success.html'

# class SubscriberFormView(View):
#     form_class = SubscriberForm
    
#     # Template that will embed the form
#     template_name = 'newsletter/subscribe.html'

#     def get(self, request, *args, **kwargs):
#         form = self.form_class
#         return render(request, self.template_name, {'form': form})
#     def post(self, request, *args, **kwards):
#         form = self.form_class(request.POST)
#         if form.is_valid():
#             form.save()
#             return HttpResponseRedirect('/success/')
#         return render(request, self.template_name, {'form': form})