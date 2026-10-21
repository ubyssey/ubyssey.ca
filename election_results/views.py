from django import forms
from django.contrib import messages
from django.contrib.auth.decorators import permission_required
from django.core.exceptions import ValidationError
from django.http import Http404, JsonResponse
from django.shortcuts import redirect, render
from django.views.decorators.cache import cache_page
from wagtail.models import Site
import logging

from .models import ElectionResultsSettings, ElectionResultsSnapshot
from .services import MAX_JSON_BYTES, manual_import

logger = logging.getLogger(__name__)


class ResultsUploadForm(forms.Form):
    results_file = forms.FileField(label="City arearesults.json", required=False)

    def clean_results_file(self):
        source = self.cleaned_data.get("results_file")
        if source and (not source.name.lower().endswith(".json") or source.size > MAX_JSON_BYTES):
            raise forms.ValidationError("Upload a JSON file no larger than 2 MB.")
        return source


@permission_required("election_results.change_electionresultssettings", raise_exception=True)
def results_admin(request):
    site = Site.find_for_request(request)
    if site is None:
        raise Http404
    config = ElectionResultsSettings.for_site(site)
    form = ResultsUploadForm(request.POST or None, request.FILES or None)
    if request.method == "POST" and form.is_valid():
        try:
            uploaded = form.cleaned_data.get("results_file")
            action = request.POST.get("action")
            if action == "upload" and not uploaded:
                raise ValidationError("Choose a JSON file to upload.")
            if action not in ("upload", "fetch"):
                raise ValidationError("Choose a valid import action.")
            snapshot = manual_import(site, uploaded.read() if action == "upload" else None)
            if snapshot is None:
                messages.warning(request, "Another results import is running; try again shortly.")
            else:
                messages.success(request, f"Results checked and saved. Source timestamp: {snapshot.source_timestamp}.")
            return redirect("election-results-admin")
        except (ValidationError, RuntimeError, OSError, ValueError) as exc:
            form.add_error(None, str(exc))
        except Exception:
            logger.exception("Manual election results import failed for site %s", site.id)
            form.add_error(None, "Import failed. The last good results are unchanged; ask a developer to check the service logs.")
    snapshot = ElectionResultsSnapshot.objects.filter(site=site).first()
    return render(request, "election_results/admin.html", {
        "form": form, "config": config, "snapshot": snapshot,
    })


def _image_url(image, filter_spec="fill-96x96"):
    if not image:
        return None
    return image.get_rendition(filter_spec).url


def _party_logo(config, party):
    normalized = " ".join(party.casefold().replace("-", " ").split())
    if "cope" in normalized:
        return config.cope_logo
    if "onecity" in normalized or "one city" in normalized:
        return config.onecity_logo
    if "vote vancouver" in normalized:
        return config.vote_vancouver_logo
    if "green" in normalized:
        return config.vancouver_greens_logo
    if "liberal" in normalized:
        return config.vancouver_liberals_logo
    if normalized == "team" or normalized.startswith("team "):
        return config.team_logo
    if normalized == "abc" or "abc vancouver" in normalized:
        return config.abc_vancouver_logo
    return None


@cache_page(30)
def results_data(request, page_id):
    site = Site.find_for_request(request)
    if site is None:
        raise Http404
    config = ElectionResultsSettings.objects.select_related(
        "pete_fry_image", "pete_fry_profile", "ken_sim_image", "ken_sim_profile",
        "colleen_hardwick_image", "colleen_hardwick_profile",
        "kareem_allam_image", "kareem_allam_profile",
        "rebecca_bligh_image", "rebecca_bligh_profile", "cope_logo", "onecity_logo",
        "vote_vancouver_logo", "vancouver_greens_logo", "vancouver_liberals_logo",
        "team_logo", "abc_vancouver_logo", "liveblog_page",
    ).filter(site=site, liveblog_page_id=page_id, liveblog_page__live=True).first()
    if config is None:
        raise Http404
    snapshot = ElectionResultsSnapshot.objects.filter(site=site).first()
    if snapshot is None:
        return JsonResponse({"available": False})

    data = snapshot.data
    mayor = []
    for candidate in data["mayor"]:
        key = candidate["asset_key"]
        profile = getattr(config, f"{key}_profile")
        mayor.append({
            **candidate,
            "image": _image_url(getattr(config, f"{key}_image")),
            "profile_url": profile.get_url(request=request) if profile and profile.live else None,
        })
    council = [{**candidate, "image": _image_url(_party_logo(config, candidate["party"]), "max-96x96")} for candidate in data["council"]]
    return JsonResponse({
        "available": True, "source_time": data["source_time"],
        "imported_at": snapshot.imported_at.isoformat(),
        "polls_total": data["polls_total"], "polls_closed": data["polls_closed"],
        "mayor": mayor, "council": council,
    })
