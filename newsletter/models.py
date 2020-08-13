from django.db import models

# Create your models here.

# Conventionally we'd add model to admin in order to see it in the admin panel. See Nigel George, p. 172, also Ch. 7
# But documentation on how to do this to Dispatch isn't clear
# @TODO: Make it visible to admin!

class Subscriber(models.Model):
    email = models.EmailField(
        verbose_name="Subscriber's email",
        unique = True
    )