from django.contrib import admin
from .models import MagazineIssue, MagazineSection

# Register your models here.

admin.site.register(MagazineIssue)
admin.site.register(MagazineSection)