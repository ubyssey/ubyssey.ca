from django.shortcuts import render
from django.http import Http404

import ubyssey

class AboutTheme(object):
    """Theme for About page."""

    def landing(self, request):
        """About landing page."""
        return render(request, 'about/index.html', {})
        
