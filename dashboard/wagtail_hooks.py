from django.utils.html import format_html
from django.templatetags.static import static

from wagtail import hooks
from wagtail.snippets.models import register_snippet
import wagtail.admin.rich_text.editors.draftail.features as draftail_features
from wagtail.admin.rich_text.converters.html_to_contentstate import InlineStyleElementHandler

from authors.views import author_chooser_viewset
from images.views import ubyssey_image_viewset
from article.views import ArticleTopicViewSet
from events.views import EventsDashboardViewSet
from content_tracker.views import story_assignment_chooser_viewset, StoryAssignmentViewSet, VisualAssignmentViewSet
from content_tracker.models import StoryAssignment
from content_tracker.signals import send_assignment_notification

@hooks.register('insert_global_admin_css')
def global_admin_css():
    return format_html('<link rel="stylesheet" href="{}">', static('css/custom.css'))

# 1. Use the register_rich_text_features hook.
@hooks.register('register_rich_text_features')
def register_strikethrough_feature(features):
    """
    Registering the `mark` feature, which uses the `MARK` Draft.js inline style type,
    and is stored as HTML with a `<mark>` tag.
    """
    feature_name = 'strikethrough'
    type_ = 'STRIKETHROUGH'
    tag = 'strikethrough'

    # 2. Configure how Draftail handles the feature in its toolbar.
    control = {
        'type': type_,
        'label': 's',
        'description': 'Strikethrough',
        # This isn’t even required – Draftail has predefined styles for MARK.
        # 'style': {'textDecoration': 'line-through'},
    }

    # 3. Call register_editor_plugin to register the configuration for Draftail.
    features.register_editor_plugin(
        'draftail', feature_name, draftail_features.InlineStyleFeature(control)
    )

    # 4.configure the content transform from the DB to the editor and back.
    db_conversion = {
        'from_database_format': {tag: InlineStyleElementHandler(type_)},
        'to_database_format': {'style_map': {type_: tag}},
    }

    # 5. Call register_converter_rule to register the content transformation conversion.
    features.register_converter_rule('contentstate', feature_name, db_conversion)

    # 6. (optional) Add the feature to the default features list to make it available
    # on rich text fields that do not specify an explicit 'features' list
    features.default_features.append('strikethrough')

@hooks.register("register_rich_text_features")
def register_centertext_feature(features):
    """Creates centered text in our richtext editor and page."""

    # Step 1
    feature_name = "center"
    type_ = "CENTERTEXT"
    tag = "div"

    # Step 2
    control = {
        "type": type_,
        "label": "Center",
        "description": "Center Text",
        "style": {
            "display": "block",
            "text-align": "center",
        },
    }

    # Step 3
    features.register_editor_plugin(
        "draftail", feature_name, draftail_features.InlineStyleFeature(control)
    )

    # Step 4
    db_conversion = {
        "from_database_format": {tag: InlineStyleElementHandler(type_)},
        "to_database_format": {
            "style_map": {
                type_: {
                    "element": tag,
                    "props": {
                        "class": "d-block text-center"
                    }
                }
            }
        }
    }

    # Step 5
    features.register_converter_rule("contentstate", feature_name, db_conversion)

    # Step 6, This is optional.
    features.default_features.append(feature_name)

@hooks.register("register_rich_text_features")
def register_righttext_feature(features):
    """Creates centered text in our richtext editor and page."""

    # Step 1
    feature_name = "right"
    type_ = "RIGHTTEXT"
    tag = "div"

    # Step 2
    control = {
        "type": type_,
        "label": "Right",
        "description": "Right Text",
        "style": {
            "display": "block",
            "text-align": "right",
        },
    }

    # Step 3
    features.register_editor_plugin(
        "draftail", feature_name, draftail_features.InlineStyleFeature(control)
    )

    # Step 4
    db_conversion = {
        "from_database_format": {tag: InlineStyleElementHandler(type_)},
        "to_database_format": {
            "style_map": {
                type_: {
                    "element": tag,
                    "props": {
                        "class": "d-block text-right"
                    }
                }
            }
        }
    }

    # Step 5
    features.register_converter_rule("contentstate", feature_name, db_conversion)

    # Step 6, This is optional.
    features.default_features.append(feature_name)

# 1. Use the register_rich_text_features hook.
@hooks.register('register_rich_text_features')
def register_redacted_feature(features):
    """
    Registering the `mark` feature, which uses the `MARK` Draft.js inline style type,
    and is stored as HTML with a `<mark>` tag.
    """
    feature_name = 'redacted'
    type_ = 'REDACTED'
    tag = "span" # This tag is currently 

    # 2. Configure how Draftail handles the feature in its toolbar.
    control = {
        'type': type_,
        'label': '▮',
        'description': 'Redacted',
        # This isn’t even required – Draftail has predefined styles for MARK.
        'style': {
            'background-color': 'currentcolor',
            },
    }

    # 3. Call register_editor_plugin to register the configuration for Draftail.
    features.register_editor_plugin(
        'draftail', feature_name, draftail_features.InlineStyleFeature(control)
    )

    # 4.configure the content transform from the DB to the editor and back.
    db_conversion = {
        'from_database_format': {tag: InlineStyleElementHandler(type_)},
        'to_database_format': {'style_map': {
            type_: {
                    "element": tag,
                    "props": {
                        "class": "d-block redacted"
                    }
                } 
            }
        },
    }

    # 5. Call register_converter_rule to register the content transformation conversion.
    features.register_converter_rule('contentstate', feature_name, db_conversion)

    # 6. (optional) Add the feature to the default features list to make it available
    # on rich text fields that do not specify an explicit 'features' list
    features.default_features.append('redacted')

# Richtext option for editors to suggest deletions inline
@hooks.register('register_rich_text_features')
def register_small_text_feature(features):
    feature_name = 'small text'
    type_ = 'SMALL_TEXT'
    tag = 'small'

    control = {
        'type': type_,
        'label': 'small',
        'description': 'Small text',
        'style': {'font-size': '0.75em'},
    }

    features.register_editor_plugin(
        'draftail', feature_name, draftail_features.InlineStyleFeature(control)
    )

    db_conversion = {
        'from_database_format': {tag: InlineStyleElementHandler(type_)},
        'to_database_format': 
            {
                'style_map': {
                    type_: 
                    {
                        "element": tag,
                    } 
                }
            },
    }

    features.register_converter_rule('contentstate', feature_name, db_conversion)

    features.default_features.append(feature_name)

# Richtext option for editors to suggest deletions inline
@hooks.register('register_rich_text_features')
def register_deletion_feature(features):
    feature_name = 'deletion'
    type_ = 'DELETION'
    tag = 'deletion'

    control = {
        'type': type_,
        'label': 'del',
        'description': 'Deletion (Inline edit)',
        'style': {'color': 'red', 'textDecoration': 'line-through'},
    }

    features.register_editor_plugin(
        'draftail', feature_name, draftail_features.InlineStyleFeature(control)
    )

    db_conversion = {
        'from_database_format': {tag: InlineStyleElementHandler(type_)},
        'to_database_format': 
            {
                'style_map': {
                    type_: 
                    {
                        "element": tag,
                    } 
                }
            },
    }

    features.register_converter_rule('contentstate', feature_name, db_conversion)

    features.default_features.append(feature_name)

# Richtext option for editors to suggest additions inline
@hooks.register('register_rich_text_features')
def register_addition_feature(features):

    feature_name = 'addition'
    type_ = 'ADDITION'
    tag = 'addition'

    control = {
        'type': type_,
        'label': 'add',
        'description': 'Addition (Inline edit)',
        'style': {'color': 'green'},
    }

    features.register_editor_plugin(
        'draftail', feature_name, draftail_features.InlineStyleFeature(control)
    )

    db_conversion = {
        'from_database_format': {tag: InlineStyleElementHandler(type_)},
        'to_database_format': 
            {
                'style_map': {
                    type_: 
                    {
                        "element": tag,
                        "props": {
                            "style": "display: none"
                        }
                    } 
                }
            },
    }

    features.register_converter_rule('contentstate', feature_name, db_conversion)

    features.default_features.append(feature_name)



@hooks.register("register_admin_viewset")
def register_viewset():
    return author_chooser_viewset

@hooks.register("register_admin_viewset")
def register_viewset():
    return story_assignment_chooser_viewset

@hooks.register("register_admin_viewset")
def register_image_chooser_viewset():
    return ubyssey_image_viewset

register_snippet(ArticleTopicViewSet)

register_snippet(EventsDashboardViewSet)

register_snippet(StoryAssignmentViewSet)

register_snippet(VisualAssignmentViewSet)


@hooks.register('after_create_snippet')
def notify_assignees_after_create(request, instance):
    """
    After a new StoryAssignment is created, email all assignees whose
    AuthorPage is linked to a User account. Uses the Wagtail hook rather
    than post_save because ClusterableModel uses bulk_create for child
    orderables, which does not fire Django's post_save signal.
    """
    if not isinstance(instance, StoryAssignment):
        return
    for rel in instance.story_assignees.all():
        send_assignment_notification(instance, rel.assignee)


@hooks.register('after_edit_snippet')
def notify_new_assignees_after_edit(request, instance):
    """
    After a StoryAssignment is edited, email any assignees who were just
    added. We detect 'new' assignees by comparing the current assignee IDs
    against those stored in the session before the save.
    """
    if not isinstance(instance, StoryAssignment):
        return

    session_key = f'assignment_{instance.pk}_assignee_ids'
    previous_ids = set(request.session.get(session_key, []))
    current_ids = set(instance.story_assignees.values_list('assignee_id', flat=True))
    new_ids = current_ids - previous_ids

    for rel in instance.story_assignees.filter(assignee_id__in=new_ids):
        send_assignment_notification(instance, rel.assignee)

    # Update session with current assignees for the next edit
    request.session[session_key] = list(current_ids)


@hooks.register('before_edit_snippet')
def store_assignees_before_edit(request, instance):
    """
    Before a StoryAssignment edit form is served, store the current
    assignee IDs in the session so after_edit_snippet can diff against them.
    """
    if not isinstance(instance, StoryAssignment):
        return
    session_key = f'assignment_{instance.pk}_assignee_ids'
    request.session[session_key] = list(
        instance.story_assignees.values_list('assignee_id', flat=True)
    )


@hooks.register('construct_page_chooser_queryset')
def order_pages_in_chooser(pages, request):
    # https://stackoverflow.com/a/61362963
    if "choose-page" in request.path:
        # showing page in a page chooser modal
        return pages.order_by('-id')  # order randomly

    # search results shown in admin/pages/search - return in default order
    return pages



from django.urls import path, reverse

from wagtail.admin.menu import MenuItem

from .views import content_tracker
from liveblog.views import liveblog_admin

@hooks.register('register_admin_urls')
def register_calendar_url():
    return [
        path('content_tracker/', content_tracker, name='content-tracker'),
    ]

@hooks.register('register_admin_urls')
def register_liveblog_admin_url():
    return [
        path('liveblog/<int:id>/', liveblog_admin, name='liveblog'),
    ]


@hooks.register('register_admin_menu_item')
def register_calendar_menu_item():
    return MenuItem('Content tracker', reverse('content-tracker'), icon_name='date')