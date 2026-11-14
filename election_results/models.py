from django.db import models
from wagtail.admin.panels import FieldPanel, MultiFieldPanel
from wagtail.contrib.settings.models import BaseSiteSetting, register_setting


@register_setting(icon="doc-full")
class ElectionResultsSettings(BaseSiteSetting):
    """Editorial presentation and opt-in automation for one election liveblog."""

    liveblog_page = models.ForeignKey(
        "liveblog.LiveBlogArticlePage", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="+",
        help_text="Only this live-updates article shows the results sidebar.",
    )
    automatic_updates_enabled = models.BooleanField(
        default=False,
        help_text="Off by default. When on, fetch every five minutes only while the linked article is live.",
    )

    pete_fry_image = models.ForeignKey("images.UbysseyImage", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    pete_fry_profile = models.ForeignKey("wagtailcore.Page", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    ken_sim_image = models.ForeignKey("images.UbysseyImage", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    ken_sim_profile = models.ForeignKey("wagtailcore.Page", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    colleen_hardwick_image = models.ForeignKey("images.UbysseyImage", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    colleen_hardwick_profile = models.ForeignKey("wagtailcore.Page", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    kareem_allam_image = models.ForeignKey("images.UbysseyImage", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    kareem_allam_profile = models.ForeignKey("wagtailcore.Page", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    rebecca_bligh_image = models.ForeignKey("images.UbysseyImage", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    rebecca_bligh_profile = models.ForeignKey("wagtailcore.Page", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")

    cope_logo = models.ForeignKey("images.UbysseyImage", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    onecity_logo = models.ForeignKey("images.UbysseyImage", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    vote_vancouver_logo = models.ForeignKey("images.UbysseyImage", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    vancouver_greens_logo = models.ForeignKey("images.UbysseyImage", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    vancouver_liberals_logo = models.ForeignKey("images.UbysseyImage", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    team_logo = models.ForeignKey("images.UbysseyImage", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    abc_vancouver_logo = models.ForeignKey("images.UbysseyImage", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")

    panels = [
        MultiFieldPanel([FieldPanel("liveblog_page"), FieldPanel("automatic_updates_enabled")], heading="Results article and updates"),
        MultiFieldPanel([
            FieldPanel("pete_fry_image"), FieldPanel("pete_fry_profile"),
            FieldPanel("ken_sim_image"), FieldPanel("ken_sim_profile"),
            FieldPanel("colleen_hardwick_image"), FieldPanel("colleen_hardwick_profile"),
            FieldPanel("kareem_allam_image"), FieldPanel("kareem_allam_profile"),
            FieldPanel("rebecca_bligh_image"), FieldPanel("rebecca_bligh_profile"),
        ], heading="Mayor portraits and profile links"),
        MultiFieldPanel([
            FieldPanel("cope_logo"), FieldPanel("onecity_logo"),
            FieldPanel("vote_vancouver_logo"), FieldPanel("vancouver_greens_logo"),
            FieldPanel("vancouver_liberals_logo"), FieldPanel("team_logo"),
            FieldPanel("abc_vancouver_logo"),
        ], heading="Council party logos"),
    ]

    class Meta:
        verbose_name = "2026 election results"


class ElectionResultsSnapshot(models.Model):
    site = models.OneToOneField("wagtailcore.Site", on_delete=models.CASCADE, related_name="election_results_snapshot")
    data = models.JSONField()
    source_timestamp = models.DateTimeField()
    imported_at = models.DateTimeField(auto_now=True)
    source = models.CharField(max_length=16, choices=[("sftp", "SFTP"), ("upload", "Manual upload")])
    sha256 = models.CharField(max_length=64)

    def __str__(self):
        return f"Election results for {self.site.hostname} at {self.source_timestamp}"
