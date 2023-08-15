"""
Certain Model fields need to be validated in a similar way accross different apps.

Import this to perform those validations
"""
import json
import re as regex

from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _

HEX_COLOUR_WEB_PATTERN = r"^#([a-fA-F0-9]{6}|[a-fA-F0-9]{3})$"
YOUTUBE_URL_PATTERN = r"(https?://)?(www\.)?(youtube|youtu|youtube-nocookie)\.(com|be)/(watch\?v=|embed/|v/|.+\?v=)?(?P<id>[A-Za-z0-9\-=_]{11})"


def validate_colour_hex(value):
    """
    Matches value against the regular expression:
    '^#([a-fA-F0-9]{6}|[a-fA-F0-9]{3})$'

    :param value: Should be string beginning with '#' followed by 6 hexit or 3 hexit colour code
    :raises ValidationError: error when regex fails to match
    """

    colour_hex_regex = regex.compile(HEX_COLOUR_WEB_PATTERN)
    if not colour_hex_regex.match(value):
        raise ValidationError(
            _("%(value)s is not a valid hex colour for web"),
            params={"value": value},
        )


def validate_youtube_url(value):
    """
    Matches value against the regular expression:
    (https?://)?(www\.)?(youtube|youtu|youtube-nocookie)\.(com|be)/(watch\?v=|embed/|v/|.+\?v=)?(?P<id>[A-Za-z0-9\-=_]{11})

    :param value: should be a Youtube URL in string form
    :raises ValidationError: error when regex fails to match
    """
    youtube_regex = regex.compile(YOUTUBE_URL_PATTERN)

    if not youtube_regex.match(value):
        raise ValidationError(
            _("%(value)s is not a valid youtube URL"),
            params={"value": value},
        )


def validate_string_as_json(value):
    if value != "":
        try:
            json.loads(value)
        except ValueError:
            raise ValidationError(
                _("Invalid JSON: \n\n %(value)s"),
                params={"value": value},
            )
