from django.shortcuts import render
from django.views.generic import View
from .forms import SubscriberForm

# Create your views here.


#TODO

class SubscriberFormView(View):
    form_class = SubscriberForm
    template_name = 'something.html'

    #Need to link this to the frontend stuff David made, somehow
    def get(self, request, *args, **kwargs):
        #form = self.form_class
        return render(request, self.template_name)
    def post(self, request, *args, **kwards):
        form = self.form_class(request.POST)
        if form.is_valid():
        