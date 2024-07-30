import socket
from django.test import override_settings
from django.contrib.staticfiles.testing import StaticLiveServerTestCase
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

@override_settings(ALLOWED_HOSTS=['*'])  # Disable ALLOWED_HOSTS
class BaseTestCase(StaticLiveServerTestCase):
    """
    Provides base test class which connects to the Docker
    container running Selenium.
    """
    host = '0.0.0.0'  # Bind to 0.0.0.0 to allow external access

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        # Set host to externally accessible web server address
        cls.host = socket.gethostbyname(socket.gethostname())

    def setUp(self):
        super().setUp()
        # Instantiate the remote WebDriver based on the browser type
        if hasattr(self, 'browser') and self.browser == 'chrome':
            chrome_options = webdriver.ChromeOptions()
            chrome_options.add_argument('--headless')
            chrome_options.add_argument('--no-sandbox')
            chrome_options.add_argument('--disable-dev-shm-usage')
            self.driver = webdriver.Remote(
                command_executor='http://selenium-chrome:4444/wd/hub',
                options=chrome_options
            )
        elif hasattr(self, 'browser') and self.browser == 'firefox':
            firefox_options = webdriver.FirefoxOptions()
            firefox_options.add_argument('--headless')
            self.driver = webdriver.Remote(
                command_executor='http://selenium-firefox:4444/wd/hub',
                options=firefox_options
            )
        else:
            edge_options = webdriver.EdgeOptions()
            edge_options.add_argument('--headless')
            self.driver = webdriver.Remote(
                command_executor='http://selenium-edge:4444/wd/hub',
                options=edge_options
            )
        self.driver.implicitly_wait(5)
    
    def tearDown(self):
        self.driver.quit()
        super().tearDown()

    def article_page_exists(self):
        WebDriverWait(self.driver, 60).until(
            EC.presence_of_all_elements_located((By.CLASS_NAME, 'author_card'))
        )
        author_cards = self.driver.find_elements(By.CLASS_NAME, 'author_card')
        self.assertGreater(len(author_cards), 0, "No author cards found on the page")
    def test_navigation_menudd(self):
        print("Pass")
        pass
    def test_navigation_menu(self):
        self.driver.get('http://host.docker.internal:8000/')
        assert "The Ubyssey" in self.driver.title
        button = self.driver.find_element(By.CSS_SELECTOR, ".c-button.c-button--small")
        button.click()
        self.driver.set_window_size(1296, 688)
        self.driver.find_element(By.CSS_SELECTOR, ".middle .nav > li:nth-child(1) > a").click()
        WebDriverWait(self.driver, 60).until(EC.title_contains("News"))
        self.driver.find_element(By.CSS_SELECTOR, "nav > .nav > li:nth-child(2) > a").click()
        WebDriverWait(self.driver, 60).until(EC.title_contains("Culture"))
        self.driver.find_element(By.CSS_SELECTOR, "nav > .nav > li:nth-child(3) > a").click()
        WebDriverWait(self.driver, 60).until(EC.title_contains("Features"))
        self.driver.find_element(By.CSS_SELECTOR, "nav > .nav > li:nth-child(4) > a").click()
        WebDriverWait(self.driver, 60).until(EC.title_contains("Opinion"))
        self.driver.find_element(By.CSS_SELECTOR, "nav > .nav > li:nth-child(5) > a").click()
        WebDriverWait(self.driver, 60).until(EC.title_contains("Humour"))
        self.driver.find_element(By.CSS_SELECTOR, "nav > .nav > li:nth-child(6) > a").click()
        WebDriverWait(self.driver, 60).until(EC.title_contains("Science"))
        self.driver.find_element(By.CSS_SELECTOR, "nav > .nav > li:nth-child(7) > a").click()
        WebDriverWait(self.driver, 60).until(EC.title_contains("Sports"))
        self.driver.find_element(By.CSS_SELECTOR, "nav > .nav > li:nth-child(8) > a").click()
        WebDriverWait(self.driver, 60).until(EC.title_contains("Photo"))
        self.driver.find_element(By.CSS_SELECTOR, "nav > .nav > li:nth-child(9) > a").click()
        WebDriverWait(self.driver, 60).until(EC.title_contains("Video"))
        self.driver.find_element(By.CSS_SELECTOR, ".home-link > .light-logo").click()
        WebDriverWait(self.driver, 60).until(EC.title_contains("The Ubyssey"))
        self.driver.find_element(By.CSS_SELECTOR, ".o-article:nth-child(2) > .o-article__right > .o-article__headline > a").click()        

    def test_cover_story(self):
        self.driver.get('http://host.docker.internal:8000/')
        self.driver.execute_script("window.scrollTo(0,444.4444885253906)")
        self.driver.find_element(By.CSS_SELECTOR, ".o-article--coverstory .o-article__headline > a").click()
        self.article_page_exists()

    def test_home_page_news_block(self):
        self.driver.get('http://host.docker.internal:8000/')
        self.driver.set_window_size(1296, 688)
        wait = WebDriverWait(self.driver, 10)
        news_story = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, ".c-homepage__section:nth-child(1) > .o-article .o-article__headline > a")))
        self.driver.execute_script("arguments[0].scrollIntoView(true);", news_story)
        news_story.click()
        news_story = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, ".c-article")))
        self.driver.execute_script("arguments[0].scrollIntoView(true);", news_story)
        news_story.click()
        self.article_page_exists()

    def test_author_page(self):
        self.driver.get('http://host.docker.internal:8000/')
        self.driver.find_element(By.CSS_SELECTOR, ".c-button.c-button--small").click()
        self.driver.find_element(By.CSS_SELECTOR, ".o-article__meta:nth-child(2) > .o-article__byline a:nth-child(1)").click()
        author_cards = self.driver.find_elements(By.CLASS_NAME, 'author-info')
        self.assertGreater(len(author_cards), 0, "Author page does not exists")    

    def test_top_article_list(self):
        self.driver.get('http://host.docker.internal:8000/')
        hide_element = self.driver.find_element(By.ID, "djHideToolBarButton")
        hide_element.click()
        self.driver.find_element(By.CSS_SELECTOR, ".o-article:nth-child(2) > .o-article__right > .o-article__headline > a").click()
        self.article_page_exists()                

    def test_dark_mode(self):
        self.driver.get('http://host.docker.internal:8000/')
        hide_element = self.driver.find_element(By.ID, "djHideToolBarButton")
        hide_element.click()
        self.driver.set_window_size(1296, 688)
        script = '''
        return getComputedStyle(document.documentElement)
            .getPropertyValue('--background').trim();
        '''
        # Execute the JavaScript and get the background value
        background_nav_value = self.driver.execute_script(script)
        # Check if the value matches the expected RGBA value
        assert background_nav_value == 'white', f"The background-nav color is incorrect. Found: {background_nav_value}"

        self.driver.find_element(By.CSS_SELECTOR, ".right .sun-and-moon").click()
        script = '''
        return getComputedStyle(document.documentElement)
            .getPropertyValue('--background').trim();
        '''
        # Execute the JavaScript and get the background value
        background_nav_value = self.driver.execute_script(script)

        # Check if the value matches the expected RGBA value
        assert background_nav_value == '#031621', f"The background-nav color is incorrect. Found: {background_nav_value}"

        self.driver.find_element(By.CSS_SELECTOR, ".right > #theme-toggle .sun").click()

    def test_news_featured_section_first_article(self):
        self.driver.get('http://host.docker.internal:8000/')
        self.driver.find_element(By.CSS_SELECTOR, ".c-button.c-button--small").click()
        self.driver.set_window_size(1296, 688)
        self.driver.find_element(By.CSS_SELECTOR, ".c-infinitefeed__feed:nth-child(1) .c-homepage__section:nth-child(2) .o-article:nth-child(1) > .o-article__meta a").click()
        self.article_page_exists()

    def test_search_bar_news(self):
        self.driver.get("http://host.docker.internal:8000/news/")
        self.driver.find_element(By.CSS_SELECTOR, ".c-button.c-button--small").click()
        self.driver.set_window_size(1296, 688)
        self.driver.find_element(By.CSS_SELECTOR, ".o-archive__search__label").click()
        self.driver.find_element(By.ID, "c-articles-list__searchbar").send_keys("UBCO")
        self.driver.find_element(By.ID, "c-articles-list__searchbar").send_keys(Keys.ENTER)
        articles = self.driver.find_elements(By.CSS_SELECTOR,"#feed article")
        # Assert that there is at least one article after searching
        assert len(articles) > 0, "No articles found in the feed section."
    
    def test_archive_in_footer(self):
        self.driver.get("http://host.docker.internal:8000/news/")
        self.driver.find_element(By.CSS_SELECTOR, ".c-button.c-button--small").click()
        self.driver.set_window_size(1296, 688)
        self.driver.execute_script("window.scrollTo(0,6560.00048828125)")
        self.driver.find_element(By.CSS_SELECTOR, ".second_footer_menu li:nth-child(1) > a").click()
        WebDriverWait(self.driver, 60).until(EC.title_contains("Archive"))
    
    def test_sidebar_latest(self):
        self.driver.get("http://host.docker.internal:8000/")
        hide_element = self.driver.find_element(By.ID, "djHideToolBarButton")
        hide_element.click()
        self.driver.find_element(By.CSS_SELECTOR, ".c-button.c-button--small").click()

        # Locate all <li> elements within the <ul class="article-list"> element
        list_items = self.driver.find_elements(By.CSS_SELECTOR, 'ul.article-list > li')

        # Assert that there are 5 <li> elements
        assert len(list_items) == 5, f"Expected 5 articles, but found {len(list_items)}."
        self.driver.find_element(By.CSS_SELECTOR, 'li:nth-child(1) .o-article__headline > a').click()
        self.article_page_exists()
                
class EdgeTestCase(BaseTestCase):
    browser = 'edge'

class ChromeTestCase(BaseTestCase):
    browser = 'chrome'

class FirefoxTestCase(BaseTestCase):
    browser = 'firefox'
