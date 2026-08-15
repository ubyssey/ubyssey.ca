# Author Management

# Is shown as contributor on frontend given the number of roles, but here we use author given the Django App

from django import forms

from article.models import ArticleAuthorsOrderable
from authors.models import AuthorPage

# Default role
AUTHOR_ROLE = "author"
# Taken from ArticleAuthorsOrderable model, update if model changes
# Alternatively look into automating
AUTHOR_ROLE_CHOICES = (
    ("author", "Author"),
    ("backfield_editor", "Backfield Editor"),
    ("copy_editor", "Copy Editor"),
    ("illustrator", "Illustrator"),
    ("photographer", "Photographer"),
    ("videographer", "Videographer"),
    ("designer", "Designer"),
    ("org_role", "Show organization role"),
)
AUTHOR_ROLE_VALUES = {value for value, _label in AUTHOR_ROLE_CHOICES}


# default if there aren't any authors
def empty_author_row():
    return {"author_id": "", "author_role": AUTHOR_ROLE}


class ArticleAuthorsForm(forms.Form):
    def __init__(self, *args, initial_rows=None, **kwargs):
        super().__init__(*args, **kwargs)
        self.initial_rows = initial_rows or []
        self.role_options = AUTHOR_ROLE_CHOICES

    @property
    def rows(self):
        if not self.is_bound:
            return self.initial_rows or [empty_author_row()]

        rows = self.posted_rows()
        return rows or [empty_author_row()]

    # Combines authors and roles into list of dictionaries, one per row
    def posted_rows(self):
        author_ids = self.data.getlist(self.add_prefix("author"))
        roles = self.data.getlist(self.add_prefix("role"))
        row_count = max(len(author_ids), len(roles), 1)
        rows = []

        for index in range(row_count):
            author_id = author_ids[index] if index < len(author_ids) else ""
            author_role = roles[index] if index < len(roles) else AUTHOR_ROLE
            if author_id or author_role != AUTHOR_ROLE:
                rows.append({"author_id": author_id, "author_role": author_role})

        return rows

    # Validates authors/roles are real, though I don't know if anyone else will ever see this lol
    def clean(self):
        cleaned_data = super().clean()
        rows = self.posted_rows()
        selected_author_ids = [row["author_id"] for row in rows if row["author_id"]]
        authors_by_id = {
            str(author.pk): author
            for author in AuthorPage.objects.live().filter(pk__in=selected_author_ids)
        }
        items = []
        for row in rows:
            author_id = row["author_id"]
            author_role = row["author_role"]
            if not author_id:
                continue
            if author_role not in AUTHOR_ROLE_VALUES:
                raise forms.ValidationError("Choose a valid author role.")
            author = authors_by_id.get(str(author_id))
            if not author:
                raise forms.ValidationError("Choose a valid author.")
            items.append({"author": author, "author_role": author_role})

        cleaned_data["items"] = items
        return cleaned_data


def get_article_authors_form(page, data=None):
    if not hasattr(page, "article_authors"):
        return None

    initial_rows = [
        {"author_id": str(item.author_id), "author_role": item.author_role or AUTHOR_ROLE}
        for item in page.article_authors.all()
    ]
    kwargs = {"prefix": "article_authors", "initial_rows": initial_rows}
    if data is not None:
        kwargs["data"] = data
    return ArticleAuthorsForm(**kwargs)


# Converts form data into ArticleAuthorsOrderable
def save_article_authors_form(page, form):
    if not hasattr(page, "article_authors"):
        return

    items = [
        ArticleAuthorsOrderable(
            author=item["author"],
            author_role=item["author_role"],
            sort_order=index,
        )
        for index, item in enumerate(form.cleaned_data.get("items") or [])
    ]
    page.article_authors.set(items)
