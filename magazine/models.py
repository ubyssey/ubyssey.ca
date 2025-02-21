import datetime

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class MagazineIssue(models.Model):
    pubdate = models.DateField(default=datetime.date.today)
    title = models.CharField(max_length=100, default="The Ubyssey Magazine")
    description = models.CharField(max_length=100, default="The Ubyssey Magazine")
    cover_image = models.ImageField(upload_to="images/%Y/%m", blank=True, null=True)
    social_cover_image = models.ImageField(
        upload_to="images/%Y/%m", blank=True, null=True
    )


class MagazineSection(models.Model):
    section_name = models.CharField(max_length=100, default="Magazine Section")
    issue = models.ForeignKey(MagazineIssue, on_delete=models.CASCADE)
    section_image = models.ImageField(upload_to="images/%Y/%m", blank=True, null=True)
