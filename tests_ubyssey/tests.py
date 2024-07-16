from asyncio import wait
from lib2to3.pgen2 import driver
from telnetlib import EC
import time
import sys
import unittest
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.service import Service as ChromeService
from selenium.webdriver.firefox.service import Service as FirefoxService
from selenium.webdriver.edge.service import Service as EdgeService
from webdriver_manager.chrome import ChromeDriverManager
from webdriver_manager.firefox import GeckoDriverManager
from webdriver_manager.microsoft import EdgeChromiumDriverManager
from selenium.webdriver.chrome.options import Options

# class TestUbysseytest:
#     def __init__(self, browser_name):
#         self.browser_name = browser_name

#     def setup_method(self, method):
#         if self.browser_name == "chrome":
#             chrome_options = Options()
#             chrome_options.add_argument("--no-sandbox")
#             chrome_options.add_argument("--disable-dev-shm-usage")
#             chrome_options.add_argument("--headless")  # Add headless mode if running in a non-GUI environment
#             self.driver = webdriver.Chrome(service=ChromeService(ChromeDriverManager().install()), options=chrome_options)
#         elif self.browser_name == "firefox":
#             self.driver = webdriver.Firefox(service=FirefoxService(GeckoDriverManager().install()))
#         elif self.browser_name == "edge":
#             self.driver = webdriver.Edge(service=EdgeService(EdgeChromiumDriverManager().install()))
#         elif self.browser_name == "safari":
#             self.driver = webdriver.Safari()
#         else:
#             raise ValueError(f"Unsupported browser: {self.browser_name}")

#         self.vars = {}

#     def teardown_method(self, method):
#         self.driver.quit()

#     def wait_for_window(self, timeout=2):
#         time.sleep(round(timeout / 1000))
#         wh_now = self.driver.window_handles
#         wh_then = self.vars["window_handles"]
#         if len(wh_now) > len(wh_then):
#             return set(wh_now).difference(set(wh_then)).pop()

#     def test_ubysseytest(self):
#         self.setup_method(None)  # Ensure setup is called before the test
#         try:
            # self.driver.get("http://localhost:8000/")
            # self.driver.get("https://ubyssey.ca/")
            # self.driver.set_window_size(1296, 688)
            # self.driver.find_element(By.CSS_SELECTOR, ".middle .nav > li:nth-child(1) > a").click()
            # self.driver.find_element(By.CSS_SELECTOR, ".open-modal > p").click()
            # self.driver.find_element(By.CSS_SELECTOR, ".category_menu li:nth-child(1) > a").click()
            # self.driver.find_element(By.CSS_SELECTOR, "nav > .nav > li:nth-child(2) > a").click()
            # element = self.driver.find_element(By.CSS_SELECTOR, "nav > .nav > li:nth-child(3) > a")
            # actions = ActionChains(self.driver)
            # actions.move_to_element(element).perform()
            # self.driver.find_element(By.CSS_SELECTOR, "nav > .nav > li:nth-child(3) > a").click()
            # element = self.driver.find_element(By.CSS_SELECTOR, "body")
            # actions = ActionChains(self.driver)
            # actions.move_to_element(element).move_by_offset(0, 0).perform()
            # self.driver.execute_script("window.scrollTo(0,111.11112213134766)")
            # self.driver.find_element(By.CSS_SELECTOR, "nav > .nav > li:nth-child(4) > a").click()
            # self.driver.find_element(By.CSS_SELECTOR, "nav > .nav > li:nth-child(5) > a").click()
            # self.driver.find_element(By.CSS_SELECTOR, "nav > .nav > li:nth-child(6) > a").click()
            # self.driver.find_element(By.CSS_SELECTOR, "nav > .nav > li:nth-child(7) > a").click()
            # self.driver.find_element(By.ID, "c-articles-list__searchbar").click()
            # self.driver.find_element(By.ID, "c-articles-list__searchbar").send_keys("UBC")
            # self.driver.find_element(By.ID, "c-articles-list__searchbar").send_keys(Keys.ENTER)
            # self.driver.find_element(By.CSS_SELECTOR, "nav > .nav > li:nth-child(8) > a").click()
            # self.driver.find_element(By.CSS_SELECTOR, "nav > .nav > li:nth-child(9) > a").click()
            # self.driver.find_element(By.CSS_SELECTOR, ".home-link > .light-logo").click()
            # element = self.driver.find_element(By.CSS_SELECTOR, ".right .sun-and-moon")
            # actions = ActionChains(self.driver)
            # actions.move_to_element(element).click_and_hold().perform()
            # element = self.driver.find_element(By.CSS_SELECTOR, ".right .sun-and-moon")
            # actions = ActionChains(self.driver)
            # actions.move_to_element(element).perform()
            # element = self.driver.find_element(By.CSS_SELECTOR, ".right .sun-and-moon")
            # actions = ActionChains(self.driver)
            # actions.move_to_element(element).release().perform()
            # # self.driver.find_element(By.CSS_SELECTOR, ".main:nth-child(6)").click()
            # # self.driver.find_element(By.CSS_SELECTOR, ".right .sun-and-moon").click()
            # self.vars["window_handles"] = self.driver.window_handles
            # # self.driver.find_element(By.CSS_SELECTOR, ".fa-facebook-square").click()
            # self.vars["win9597"] = self.wait_for_window(2000)
            # self.vars["root"] = self.driver.current_window_handle
            # self.driver.switch_to.window(self.vars["win9597"])
            # self.driver.switch_to.window(self.vars["root"])
            # self.vars["window_handles"] = self.driver.window_handles
            # # self.driver.find_element(By.CSS_SELECTOR, ".twitter-icon").click()
            # self.vars["win6259"] = self.wait_for_window(2000)
            # self.driver.switch_to.window(self.vars["win6259"])
            # self.driver.switch_to.window(self.vars["root"])
            # self.vars["window_handles"] = self.driver.window_handles
            # # self.driver.find_element(By.CSS_SELECTOR, ".fa-brands").click()
            # self.vars["win4717"] = self.wait_for_window(2000)
            # self.driver.switch_to.window(self.vars["win4717"])
            # self.driver.switch_to.window(self.vars["root"])
            # self.vars["window_handles"] = self.driver.window_handles
            # # self.driver.find_element(By.CSS_SELECTOR, ".fa-instagram").click()
            # self.vars["win9746"] = self.wait_for_window(2000)
            # self.driver.switch_to.window(self.vars["win9746"])
            # self.driver.switch_to.window(self.vars["root"])
            # self.vars["window_handles"] = self.driver.window_handles
            # # self.driver.find_element(By.CSS_SELECTOR, ".fa-rss").click()
            # self.vars["win780"] = self.wait_for_window(2000)
            # self.driver.switch_to.window(self.vars["win780"])
            # self.driver.switch_to.window(self.vars["root"])
            # self.driver.find_element(By.CSS_SELECTOR, ".home-link > .dark-logo").click()
            # self.driver.execute_script("window.scrollTo(0,103.7037124633789)")
            # self.driver.find_element(By.CSS_SELECTOR, ".o-article__meta:nth-child(2) .o-article__section-tag").click()
            # self.driver.find_element(By.CSS_SELECTOR, ".home-link > .dark-logo").click()
            # self.driver.find_element(By.CSS_SELECTOR, ".o-article:nth-child(2) > .o-article__right > .o-article__headline > a").click()
            # self.driver.find_element(By.CSS_SELECTOR, ".home-link > .dark-logo").click()
            # self.driver.execute_script("window.scrollTo(0,60.000003814697266)")
            # self.driver.find_element(By.CSS_SELECTOR, ".c-homepage__section:nth-child(1) > .section > a").click()
            # self.driver.find_element(By.CSS_SELECTOR, ".c-homepage__section:nth-child(1) .o-article:nth-child(1) > .o-article__meta a").click()
            # self.driver.find_element(By.CSS_SELECTOR, ".home-link > .dark-logo").click()
            # self.driver.execute_script("window.scrollTo(0,666.6666870117188)")
            # self.driver.find_element(By.CSS_SELECTOR, ".second_footer_menu li:nth-child(6) > a").click()
            # self.driver.find_element(By.CSS_SELECTOR, ".home-link > .dark-logo").click()
            # self.driver.switch_to.frame(5)
#         finally:
#             self.teardown_method(None)  # Ensure teardown is called after the test

# if __name__ == "__main__":
#     if len(sys.argv) != 2:
#         print("Usage: python test_usability.py [browser_name]")
#         sys.exit(1)

#     browser_name = sys.argv[1]
#     test = TestUbysseytest(browser_name)
#     test.test_ubysseytest()
from django.test import LiveServerTestCase
from selenium import webdriver
import time
from selenium.webdriver.chrome.service import Service


# class LiveUbysseyTest(LiveServerTestCase):
# #             chrome_options = Options()
# #             chrome_options.add_argument("--no-sandbox")
# #             chrome_options.add_argument("--disable-dev-shm-usage")
# #             chrome_options.add_argument("--headless")  # Add headless mode if running in a non-GUI environment
# #             self.driver = webdriver.Chrome(service=ChromeService(ChromeDriverManager().install()), options=chrome_options)
    
#     def test_ubyssey(self):
    
#     # def tearDown(self):
#     #     self.driver.quit()
from django.contrib.staticfiles.testing import StaticLiveServerTestCase
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

class TestUbyssey(StaticLiveServerTestCase):
    def test_ubyssey(self):
        chrome_options = Options()
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--headless")  # Add headless mode if running in a non-GUI environment
        prefs = {"profile.default_content_settings.cookies": 2}
        chrome_options.add_experimental_option("prefs", prefs)
        self.driver = webdriver.Chrome(service=ChromeService(ChromeDriverManager().install()), options=chrome_options)
        # self.driver = webdriver.Chrome(options=chrome_options)
        # self.driver.get('https://ubyssey.ca/')
        self.driver.get('http://localhost:8000/')
        assert "The Ubyssey" in self.driver.title
        self.driver.set_window_size(1296, 688)
        self.driver.find_element(By.CSS_SELECTOR, ".middle .nav > li:nth-child(1) > a").click()
        # self.driver.find_element(By.CSS_SELECTOR, ".open-modal > p").click()
        # self.driver.find_element(By.CSS_SELECTOR, ".category_menu li:nth-child(1) > a").click()
        assert "News" in self.driver.title
        self.driver.find_element(By.CSS_SELECTOR, "nav > .nav > li:nth-child(2) > a").click()
        self.driver.find_element(By.CSS_SELECTOR, "nav > .nav > li:nth-child(3) > a").click()
        self.driver.find_element(By.CSS_SELECTOR, "nav > .nav > li:nth-child(4) > a").click()
        self.driver.find_element(By.CSS_SELECTOR, "nav > .nav > li:nth-child(4) > a").click()
        self.driver.find_element(By.CSS_SELECTOR, "nav > .nav > li:nth-child(5) > a").click()
        self.driver.find_element(By.CSS_SELECTOR, "nav > .nav > li:nth-child(6) > a").click()
        self.driver.find_element(By.CSS_SELECTOR, "nav > .nav > li:nth-child(7) > a").click()
        self.driver.find_element(By.CSS_SELECTOR, "nav > .nav > li:nth-child(8) > a").click()
        self.driver.find_element(By.CSS_SELECTOR, "nav > .nav > li:nth-child(9) > a").click()
        self.driver.find_element(By.CSS_SELECTOR, ".home-link > .light-logo").click()
        self.driver.find_element(By.CSS_SELECTOR, ".o-article:nth-child(2) > .o-article__right > .o-article__headline > a").click()
        html_content = self.driver.page_source
        # output_file = "output.html"
        # with open(output_file, "w", encoding="utf-8") as file:
        #     file.write(html_content)
        self.driver.get('http://localhost:8000/')
        self.driver.execute_script("window.scrollTo(0,444.4444885253906)")
        self.driver.find_element(By.CSS_SELECTOR, ".o-article--coverstory .o-article__headline > a").click()        

        # assert 'Top Stories' == self.driver.find_element(By.CSS_SELECTOR, 'h1.boxText.boxText-left').text        # self.driver.find_element(By.CSS_SELECTOR, ".o-article--coverstory .o-article__headline > a").click()
        # article_element = driver.find_element(By.CSS_SELECTOR, 'article.o-article.o-article--coverstory').click()
        # wait = WebDriverWait(driver, 30)  # Wait up to 10 seconds
        # element = WebDriverWait(driver, 10).until(
        #     EC.presence_of_element_located((By.CSS_SELECTOR, ".o-article--coverstory .o-article__headline > a"))
        # )
        # # Click the link within the article
        # element.click()

        # self.driver.find_element(By.CSS_SELECTOR, ".o-article--coverstory .o-article__headline > a").click()
        # self.driver.get('http://localhost:8000/')
        # self.driver.execute_script("window.scrollTo(0,444.4444885253906)")
        # self.driver.execute_script("window.scrollTo(0,1111.1112060546875)")
        # self.driver.execute_script("window.scrollTo(0,1222.2222900390625)")
        # self.driver.find_element(By.CSS_SELECTOR, ".c-infinitefeed__feed:nth-child(1) .c-homepage__section:nth-child(2) > .o-article .o-article__headline > a").click()
        # self.driver.find_element(By.CSS_SELECTOR, ".c-infinitefeed__feed:nth-child(1) .c-homepage__section:nth-child(2) .o-article:nth-child(1) > .o-article__meta a").click()
        # self.driver.find_element(By.CSS_SELECTOR, "li:nth-child(1) .o-article__headline > a").click()
        self.driver.get("http://localhost:8000/")
        self.driver.set_window_size(1296, 688)
        self.driver.find_element(By.CSS_SELECTOR, ".o-article:nth-child(2) > .o-article__right > .o-article__headline > a").click()

        element = self.driver.find_element(By.CSS_SELECTOR, "nav > .nav > li:nth-child(4) > a")
        actions = ActionChains(self.driver)
        actions.move_to_element(element).perform()
        self.driver.get("http://localhost:8000/")
        self.driver.set_window_size(1296, 688)
        # wait = WebDriverWait(self.driver, 10)
        # cache_panel_link = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "a.CachePanel")))
        # cache_panel_link.click()
        # wait = WebDriverWait(self.driver, 10)
        # continue_button = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, ".c-button.c-button--small")))
        # continue_button.click()
        # Locate the news element and scroll to it
        wait = WebDriverWait(self.driver, 10)
        news_story = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, ".c-homepage__section:nth-child(1) > .o-article .o-article__headline > a")))
        self.driver.execute_script("arguments[0].scrollIntoView(true);", news_story)
        news_story.click()
        
        # Locate the second element and scroll to it
        news_story = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, ".c-article")))
        self.driver.execute_script("arguments[0].scrollIntoView(true);", news_story)
        news_story.click()
        self.driver.get("http://localhost:8000/")
        self.driver.set_window_size(1296, 688)
        # Locate and scroll to the first news recommendation in the left sidebar then click it
        news_first_recommendation = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, ".c-homepage__section:nth-child(1) .o-article:nth-child(1) .o-article__headline")))
        self.driver.execute_script("arguments[0].scrollIntoView(true);", news_first_recommendation)
        news_first_recommendation.click()
        # news_first_recommendation = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, ".c-homepage__section:nth-child(1) .o-article:nth-child(1) > .o-article__meta a")))
        # self.driver.execute_script("arguments[0].scrollIntoView(true);", news_first_recommendation)
        # news_first_recommendation.click()
        self.driver.get("http://localhost:8000/")

        # Locate and scroll to the first  recommended article element in the right sidebar then click it
        first_recommended_article = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "li:nth-child(1) .o-article__headline > a")))
        self.driver.execute_script("arguments[0].scrollIntoView(true);", first_recommended_article)
        first_recommended_article.click()
        self.driver.get("http://localhost:8000/")

        # Locate and scroll to the author link on news article then click it
        author_link = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, ".c-homepage__section:nth-child(1) .o-article__byline a:nth-child(1)")))
        self.driver.execute_script("arguments[0].scrollIntoView(true);", author_link)
        author_link.click()
        # Locate the sun icon to switch to dark mode
        sun_icon = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, ".right .sun-and-moon")))
        self.driver.execute_script("arguments[0].scrollIntoView(true);", sun_icon)
        sun_icon.click()

        print("Success") 
