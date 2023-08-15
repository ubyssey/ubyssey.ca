from datetime import datetime

from dispatch.tests.cases import DispatchAPITestCase, DispatchMediaTestMixin
from dispatch.theme.exceptions import InvalidField, WidgetNotFound

from ubyssey.events.models import Event
from ubyssey.fields import EventField
from ubyssey.tests.helpers import DispatchTestHelpers


class TestZone(Zone):
    id = "test-zone"
    name = "Test zone"


class TestWidget(Widget):
    id = "test-widget"
    name = "Test widget"
    template = "widgets/test-widget.html"

    zones = [TestZone]

    title = CharField("Title")
    description = TextField("Description")
    article = ArticleField("Featured article")
    image = ImageField("Featured image")
    widget = WidgetField("Featured Widget")


class TestWidget2(Widget):
    id = "test-widget-2"
    name = "Test widget 2"
    template = "widgets/test-widget.html"

    zones = [TestZone]

    title = CharField("Title 2")
    description = TextField("Description 2")
    article = ArticleField("Featured article 2")
    image = ImageField("Featured image 2")
    widget = WidgetField("Featured Widget 2")


class TestWidget3(Widget):
    id = "test-widget-3"
    name = "Test widget 3"
    template = "widgets/test-widget.html"

    zones = [TestZone]

    title = CharField("Title")


class WidgetFieldTest(DispatchAPITestCase, DispatchMediaTestMixin):
    def test_event_field(self):
        """Should be able to create event Field"""

        testfield = EventField("Title", many=True)

        event_1 = DispatchTestHelpers.create_event(self.client, title="Test title 1")
        event_2 = DispatchTestHelpers.create_event(self.client, title="Test title 2")

        data = [event_1.data["id"], event_2.data["id"]]

        try:
            testfield.validate(data)
        except InvalidField:
            self.fail("Field data is valid, exception should not have been thrown")

        json = testfield.to_json(data)

        # Test some example entries
        self.assertEqual(json[0]["id"], 1)
        self.assertEqual(json[1]["id"], 2)
        self.assertEqual(json[0]["title"], "Test title 1")
        self.assertEqual(json[1]["title"], "Test title 2")

    def test_event_single_id(self):
        """Should be able to create event field with only 1 id"""

        testfield = EventField("Title")

        event = DispatchTestHelpers.create_event(self.client)

        data = event.data["id"]

        try:
            testfield.validate(data)
        except InvalidField:
            self.fail("Field data is valid, exception should not have been thrown")

        json = testfield.to_json(data)

        # Test some example entries
        self.assertEqual(json["id"], 1)
        self.assertEqual(json["title"], "Test event")

    def test_event_prepare_data(self):
        """Should be able to return prepared data for the template"""

        testfield = EventField("Title", many=True)

        event_1 = DispatchTestHelpers.create_event(
            self.client, title="Test title 1", description="test description 1"
        )
        event_2 = DispatchTestHelpers.create_event(
            self.client, title="Test title 2", description="test description 2"
        )

        data = [event_1.data["id"], event_2.data["id"]]

        try:
            testfield.validate(data)
        except InvalidField:
            self.fail("Field data is valid, exception should not have been thrown")

        result = testfield.prepare_data(data)

        self.assertEqual(result[0].title, event_1.data["title"])
        self.assertEqual(result[1].title, event_2.data["title"])

    def test_event_false_many(self):
        """Test the case where many is false when you have more than 1 event"""

        testfield = EventField("Title")

        event_1 = DispatchTestHelpers.create_event(
            self.client, title="Test title 1", description="test description"
        )
        event_2 = DispatchTestHelpers.create_event(
            self.client, title="Test title 2", description="test description"
        )

        data = [event_1.data["id"], event_2.data["id"]]

        try:
            testfield.validate(data)
            self.fail("Field data is invalid, exception should have been thrown")
        except InvalidField:
            pass

    def test_event_singular_data(self):
        """Test the case where EventField is initialized with many, but given 1 piece of data"""

        testfield = EventField("Title", many=True)

        event_1 = DispatchTestHelpers.create_event(
            self.client, title="Test title 1", description="test description"
        )

        data = event_1.data["id"]

        try:
            testfield.validate(data)
            self.fail("Field data is invalid, exception should have been thrown")
        except InvalidField:
            pass

    def test_event_doesnt_exist(self):
        """Test the case where an event id for an event that doesn't exist is passed as data"""

        testfield = EventField("Title")

        id = -1

        try:
            testfield.get_model(id)
            self.fail("Field data is invalid, exception should have been thrown")
        except Event.DoesNotExist:
            pass

    def test_event_to_json_no_data(self):
        """Passing data=None to to_json returns None"""

        testfield = EventField("Title")

        data = None

        self.assertEqual(testfield.to_json(data), None)
