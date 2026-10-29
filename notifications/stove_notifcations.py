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
        return "You were included in a new story on Stove"
    
    def getNotificationBody(self) -> str:
        return f"You were included with the role: '{self.role}' in '{self.story_title}'."
    
    # the url the notfication redirects you to when you click on it
    def getStoryUrl(self) -> str:
        return f"/stove/page/{self.story_id}"
    


# note: we assume here that the Author full name is equivalent to the full name defined in their stove account    
def send_stove_notification(author_id: str, notification_info: NotificationAction):
    
    username = AuthorPage.objects.get(id=author_id).full_name
    print(username)
    first_name, last_name = username.split(" ", 1) # this looks ugly

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
