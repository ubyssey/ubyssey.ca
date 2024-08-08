import argparse
import os
import socket
import sys
from django.core.management import execute_from_command_line
from django.test import override_settings
from django.contrib.staticfiles.testing import StaticLiveServerTestCase
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.action_chains import ActionChains

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
        cls.browser = os.getenv('BROWSER', 'chrome')
        cls.ci_environment = os.getenv('CI_ENVIRONMENT', 'development')

    def setUp(self):
        super().setUp()
        # Determine the command executor URL based on the CI environment
        if self.ci_environment == 'testing':
            if hasattr(self, 'browser') and self.browser == 'chrome':
                command_executor = 'http://localhost:4444/wd/hub'
            elif hasattr(self, 'browser') and self.browser == 'firefox':
                command_executor = 'http://localhost:4446/wd/hub'
            else:
                command_executor = 'http://localhost:4445/wd/hub'
        else:
            if hasattr(self, 'browser') and self.browser == 'chrome':
                command_executor = 'http://selenium-chrome:4444/wd/hub'
            elif hasattr(self, 'browser') and self.browser == 'firefox':
                command_executor = 'http://selenium-firefox:4444/wd/hub'
            elif hasattr(self, 'browser') and self.browser == 'edge':
                command_executor = 'http://selenium-edge:4444/wd/hub'
            else:
                raise ValueError(f"Unsupported browser: {self.browser}")

        # Instantiate the remote WebDriver based on the browser type
        if hasattr(self, 'browser') and self.browser == 'chrome':
            chrome_options = webdriver.ChromeOptions()
            chrome_options.add_argument('--headless')
            chrome_options.add_argument('--no-sandbox')
            chrome_options.add_argument('--disable-dev-shm-usage')
            self.driver = webdriver.Remote(
                command_executor=command_executor,
                options=chrome_options
            )
        elif hasattr(self, 'browser') and self.browser == 'firefox':
            firefox_options = webdriver.FirefoxOptions()
            firefox_options.add_argument('--headless')
            self.driver = webdriver.Remote(
                command_executor=command_executor,
                options=firefox_options
            )
        elif hasattr(self, 'browser') and self.browser == 'edge':
            edge_options = webdriver.EdgeOptions()
            edge_options.add_argument('--headless')
            self.driver = webdriver.Remote(
                command_executor=command_executor,
                options=edge_options
            )
        else:
            raise ValueError(f"Unsupported browser: {self.browser}")
        self.driver.implicitly_wait(5)
    
    def tearDown(self):
        self.driver.quit()
        super().tearDown()

class MySeleniumTests(BaseTestCase):
    fixtures = ['tests.json']
    
    def article_page_exists(self):
        WebDriverWait(self.driver, 60).until(
            EC.presence_of_all_elements_located((By.CLASS_NAME, 'author_card'))
        )
        author_cards = self.driver.find_elements(By.CLASS_NAME, 'author_card')
        self.assertGreater(len(author_cards), 0, "No author cards found on the page")

    def test_ubyssey_homepage(self):
        #Testing the cover story works image is displayed
        base_url = f'{self.live_server_url}/'
        self.driver.get(base_url)
        WebDriverWait(self.driver, 10).until(
            EC.presence_of_element_located((By.XPATH, "//img[@src='/media/renditions/housing_explainer.width-1200.for.width-1320.format-webp.webp']"))
        )
        image = self.driver.find_element(By.XPATH, "//img[@src='/media/renditions/housing_explainer.width-1200.for.width-1320.format-webp.webp']")
        assert image.is_displayed(), "Image is not displayed on the page."

        #Testing the cover story works
        self.driver.get(f'{self.live_server_url}/')
        self.driver.execute_script("window.scrollTo(0,444.4444885253906)")
        self.driver.find_element(By.CSS_SELECTOR, ".o-article--coverstory .o-article__headline > a").click()
        self.article_page_exists()
        
        #Testing the navigation menu works. That is test the sections which are News, 
        # Culture, Features, Opinion, Humour, Science, Sports, Photo, Video 
        self.driver.get(f'{self.live_server_url}/')
        assert "The Ubyssey" in self.driver.title
        self.driver.set_window_size(1920, 1080)
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
        
        #Test Ubyssey homepage button works        
        light_logo = self.driver.find_element(By.CSS_SELECTOR, 'img.light-logo')
        # Click on the light logo
        ActionChains(self.driver).move_to_element(light_logo).click().perform()
        WebDriverWait(self.driver, 60).until(EC.title_contains("The Ubyssey"))
        self.driver.find_element(By.CSS_SELECTOR, ".o-article:nth-child(2) > .o-article__right > .o-article__headline > a").click()        
        
        # Test the news article image is correctly rendered and displayed
        self.driver.get(f'{self.live_server_url}/')
        image_xpath = "//a[@class='o-article__image']/img[@src='/media/renditions/Longhouse_201308.2e16d0ba.fill-340x238-c100.format-webp.webp']"
        WebDriverWait(self.driver, 10).until(
            EC.presence_of_element_located((By.XPATH, image_xpath))
        )
        image = self.driver.find_element(By.XPATH, image_xpath)
        assert image.is_displayed(), "Image is not displayed on the page."

        # Test the article news section works
        self.driver.set_window_size(1920, 1080)
        wait = WebDriverWait(self.driver, 10)        
        wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, ".o-article__meta > .o-article__headline > a"))).click()
        self.article_page_exists()

        # Test the author page works
        self.driver.get(f'{self.live_server_url}/')
        self.driver.set_window_size(1920, 1080)
        # Find the author's link and extract the href attribute
        author_link_element = self.driver.find_element(By.CSS_SELECTOR, ".o-article__byline .o-article__author a")
        author_link = author_link_element.get_attribute("href")
        relative_url = author_link.split('http://localhost:8000/')[-1]
        full_url = f'{self.live_server_url}/{relative_url}'
        self.driver.get(full_url)
        WebDriverWait(self.driver, 10).until(
            EC.presence_of_all_elements_located((By.CLASS_NAME, 'author-info'))
        )
        # Find the author information
        author_info = self.driver.find_elements(By.CLASS_NAME, 'author-info')
        assert len(author_info) > 0, "Author page does not exist"
    
        #Test the top article image is correctly rendered and displayed    
        self.driver.get(f'{self.live_server_url}/')       
        WebDriverWait(self.driver, 10).until(
            EC.presence_of_element_located((By.XPATH, "//img[@src='/media/renditions/housing_explaine.2e16d0ba.fill-150x150-c100.format-webp.webp']"))
        )
        image = self.driver.find_element(By.XPATH, "//img[@src='/media/renditions/housing_explaine.2e16d0ba.fill-150x150-c100.format-webp.webp']")
        assert image.is_displayed(), "Image is not displayed on the page."

        #Test the top article link works
        self.driver.find_element(By.CSS_SELECTOR, ".o-article--top_article .o-article__headline > a").click()
        self.article_page_exists()     
        
        #Test the news article recommended list link works
        self.driver.get(f'{self.live_server_url}/')
        self.driver.set_window_size(1920, 1080)
        self.driver.find_element(By.CSS_SELECTOR, ".o-article > .o-article__headline > a").click()
        self.article_page_exists()
        
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Django management command with browser argument.')
    parser.add_argument(
        '--BROWSER', 
        choices=['chrome', 'firefox', 'edge'], 
        default='chrome', 
        help='Specify the browser to use for tests.'
    )
    args = parser.parse_args()
    
    parser.add_argument(
        '--CI_ENV',
        choices=['development', 'testing'],
        default='development',
        help='Specify the CI environment.'
    )
    args = parser.parse_args()
    
    # Set the browser type as an environment variable
    os.environ['BROWSER'] = args.browser
    os.environ['CI_ENV'] = args.ci_env

    execute_from_command_line(sys.argv)