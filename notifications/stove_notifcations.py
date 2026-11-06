#to be moved in the future into the stove folder, I'm just too lazy to do it rn

from webpush import send_user_notification
from django.contrib.auth import get_user_model

from authors.models import AuthorPage

from dataclasses import dataclass
from abc import ABC, abstractmethod

class NotificationAction(ABC):

    @abstractmethod
    def getNotificationHeader(self) -> str:
        pass

    @abstractmethod
    def getNotificationBody(self) -> str:
        pass

    @abstractmethod
    def getStoryUrl(self) -> str:
        pass

@dataclass
class StoryCreated(NotificationAction):

    role: str
    story_title: str
    story_id: str 

    def getNotificationHeader(self) -> str:
        return "Story Created"
    
    def getNotificationBody(self) -> str:
        return f"You were assigned with the role: '{self.role}' in '{self.story_title}'."
    
    # the url the notfication redirects you to when you click on it
    def getStoryUrl(self) -> str:
        return f"/stove/page/{self.story_id}"

@dataclass   
class CommentAdded(NotificationAction):

    story_title: str
    story_id: str
    comment_body: str
    commenter: str  #full name of the individual who created the comment

    def getNotificationHeader(self) -> str:
        return f"{self.commenter} commented on '{self.story_title}'"
    
    def getNotificationBody(self):
        return f"\"{self.comment_body}\"\nYou received this notification because you are listed as a contributor to this story."

    def getStoryUrl(self) -> str:
        return f"/stove/page/{self.story_id}"    


@dataclass 
class StatusChange(NotificationAction):

    notif_body: str
    notif_header: str
    #story_id: str

    def __init__(self, prev_status, cur_status, story_title):
        if cur_status == 2:
            # notification set to filed
            self.notif_header = "Story filed"
            self.notif_body = f"'{story_title}' has been filed for edits."
        elif cur_status == 3:
            self.notif_header = "Story edited"
            self.notif_body = f"{story_title} has been returned with edits."
        elif prev_status == 2 and cur_status == 1:
            self.notif_header = "Story rejected"
            self.notif_body = f"{story_title} was not ready for edits and was rejected."
        else:
            raise ValueError(f"{prev_status} to {cur_status} is not a valid notification status pattern")
        #self.story_id = story_id
        super().__init__()
        

    def getNotificationHeader(self):
        return self.notif_header
    
    def getNotificationBody(self):
        return self.notif_body
    
    def getStoryUrl(self):
        return f"/stove"  

@dataclass
class DailyDigest(ABC):

    headlines: list[str] #for now we'll just save it as a list of slugs

    def getFormattedHeadlines(self) -> str:
        parts = []

        for index, value in enumerate(self.headlines, start = 1):
            entry = f"{index}: {value}"
            parts.append(entry)
        
        return "\n".join(parts)
    
    def getStoryCount(self) -> int:
        return self.headlines.count
    
class EditorDigest(NotificationAction, DailyDigest):

    def __init__(self, headlines):
        NotificationAction.__init__(self)
        DailyDigest.__init__(self, headlines)
    
    def getNotificationHeader(self):
        return "Morning editing digest"
    
    def getNotificationBody(self):
        return f"""You are assigned to edit {super().getStoryCount()} stories today:
                   {super().getFormattedHeadlines()}
                """

    def getStoryUrl(self):
        return f"/stove"  

class AuthorDigest(NotificationAction, DailyDigest):

    def __init__(self, headlines):
        NotificationAction.__init__(self)
        DailyDigest.__init__(self, headlines)
    
    def getNotificationHeader(self):
        return "Morning author digest"

    def getNotificationBody(self):
        return f"""You are assigned to write {super().getStoryCount()} stories today:
                   {super().getFormattedHeadlines()}
                """
    
    def getStoryUrl(self):
        return f"/stove"  

    
# note: we assume here that the Author full name is equivalent to the full name defined in their stove account    
def send_stove_notification(author_id: str, notification_info: NotificationAction):
    
    username = AuthorPage.objects.get(id=author_id).full_name
    print(username)
    send_stove_notification_full(username, notification_info)

def send_stove_notification_full(author_full_name: str, notification_info: NotificationAction):
    first_name, last_name = author_full_name.split(" ", 1) # this looks ugly

    User = get_user_model()
    user = User.objects.get(first_name = first_name, last_name = last_name)

    payload = {
        "head": notification_info.getNotificationHeader(),
        "body": notification_info.getNotificationBody(),
        "url": notification_info.getStoryUrl()
    }
    send_user_notification(
        user=user,
        payload=payload,
        ttl=1000,
    )
    print("notification fired")

def send_stove_notification_grouped(authors_full_name: list[str], notification_info: NotificationAction):
    for full_name in authors_full_name:
        send_stove_notification_full(full_name, notification_info)
