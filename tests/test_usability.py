import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.service import Service as ChromeService
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.firefox.service import Service as FirefoxService
from webdriver_manager.firefox import GeckoDriverManager
from selenium.webdriver.edge.service import Service as EdgeService
from webdriver_manager.microsoft import EdgeChromiumDriverManager

class TestUbysseytest():
  def setup_method(self, method):
        if self.browser_name == "chrome":
            self.driver = webdriver.Chrome(service=ChromeService(ChromeDriverManager().install()))
        elif self.browser_name == "firefox":
            self.driver = webdriver.Firefox(service=FirefoxService(GeckoDriverManager().install()))
        elif self.browser_name == "edge":
            self.driver = webdriver.Edge(service=EdgeService(EdgeChromiumDriverManager().install()))
        elif self.browser_name == "safari":
            self.driver = webdriver.Safari()
        else:
            raise ValueError(f"Unsupported browser: {self.browser_name}")

        self.vars = {}
  
  def teardown_method(self, method):
    self.driver.quit()
  
  def wait_for_window(self, timeout = 2):
    time.sleep(round(timeout / 1000))
    wh_now = self.driver.window_handles
    wh_then = self.vars["window_handles"]
    if len(wh_now) > len(wh_then):
      return set(wh_now).difference(set(wh_then)).pop()
  
  def test_ubysseytest(self):
    self.driver.get("http://localhost:8000//")
    self.driver.set_window_size(1296, 688)
    self.driver.find_element(By.CSS_SELECTOR, ".middle .nav > li:nth-child(1) > a").click()
    self.driver.find_element(By.CSS_SELECTOR, ".open-modal > p").click()
    self.driver.find_element(By.CSS_SELECTOR, ".category_menu li:nth-child(1) > a").click()
    self.driver.find_element(By.CSS_SELECTOR, "nav > .nav > li:nth-child(2) > a").click()
    element = self.driver.find_element(By.CSS_SELECTOR, "nav > .nav > li:nth-child(3) > a")
    actions = ActionChains(self.driver)
    actions.move_to_element(element).perform()
    self.driver.find_element(By.CSS_SELECTOR, "nav > .nav > li:nth-child(3) > a").click()
    element = self.driver.find_element(By.CSS_SELECTOR, "body")
    actions = ActionChains(self.driver)
    actions.move_to_element(element, 0, 0).perform()
    self.driver.execute_script("window.scrollTo(0,111.11112213134766)")
    self.driver.find_element(By.CSS_SELECTOR, "nav > .nav > li:nth-child(4) > a").click()
    self.driver.find_element(By.CSS_SELECTOR, "nav > .nav > li:nth-child(5) > a").click()
    self.driver.find_element(By.CSS_SELECTOR, "nav > .nav > li:nth-child(6) > a").click()
    self.driver.find_element(By.CSS_SELECTOR, "nav > .nav > li:nth-child(7) > a").click()
    self.driver.find_element(By.ID, "c-articles-list__searchbar").click()
    self.driver.find_element(By.ID, "c-articles-list__searchbar").send_keys("UBC")
    self.driver.find_element(By.ID, "c-articles-list__searchbar").send_keys(Keys.ENTER)
    self.driver.find_element(By.CSS_SELECTOR, "nav > .nav > li:nth-child(8) > a").click()
    self.driver.find_element(By.CSS_SELECTOR, "nav > .nav > li:nth-child(9) > a").click()
    self.driver.find_element(By.CSS_SELECTOR, ".home-link > .light-logo").click()
    element = self.driver.find_element(By.CSS_SELECTOR, ".right .sun-and-moon")
    actions = ActionChains(self.driver)
    actions.move_to_element(element).click_and_hold().perform()
    element = self.driver.find_element(By.CSS_SELECTOR, ".right .sun-and-moon")
    actions = ActionChains(self.driver)
    actions.move_to_element(element).perform()
    element = self.driver.find_element(By.CSS_SELECTOR, ".right .sun-and-moon")
    actions = ActionChains(self.driver)
    actions.move_to_element(element).release().perform()
    self.driver.find_element(By.CSS_SELECTOR, ".main:nth-child(6)").click()
    self.driver.find_element(By.CSS_SELECTOR, ".right .sun-and-moon").click()
    self.vars["window_handles"] = self.driver.window_handles
    self.driver.find_element(By.CSS_SELECTOR, ".fa-facebook-square").click()
    self.vars["win9597"] = self.wait_for_window(2000)
    self.vars["root"] = self.driver.current_window_handle
    self.driver.switch_to.window(self.vars["win9597"])
    self.driver.switch_to.window(self.vars["root"])
    self.vars["window_handles"] = self.driver.window_handles
    self.driver.find_element(By.CSS_SELECTOR, ".twitter-icon").click()
    self.vars["win6259"] = self.wait_for_window(2000)
    self.driver.switch_to.window(self.vars["win6259"])
    self.driver.switch_to.window(self.vars["root"])
    self.vars["window_handles"] = self.driver.window_handles
    self.driver.find_element(By.CSS_SELECTOR, ".fa-brands").click()
    self.vars["win4717"] = self.wait_for_window(2000)
    self.driver.switch_to.window(self.vars["win4717"])
    self.driver.switch_to.window(self.vars["root"])
    self.vars["window_handles"] = self.driver.window_handles
    self.driver.find_element(By.CSS_SELECTOR, ".fa-instagram").click()
    self.vars["win9746"] = self.wait_for_window(2000)
    self.driver.switch_to.window(self.vars["win9746"])
    self.driver.switch_to.window(self.vars["root"])
    self.vars["window_handles"] = self.driver.window_handles
    self.driver.find_element(By.CSS_SELECTOR, ".fa-rss").click()
    self.vars["win780"] = self.wait_for_window(2000)
    self.driver.switch_to.window(self.vars["win780"])
    self.driver.switch_to.window(self.vars["root"])
    self.driver.find_element(By.CSS_SELECTOR, ".o-article--coverstory .o-article__headline > a").click()
    self.driver.find_element(By.CSS_SELECTOR, ".home-link > .dark-logo").click()
    self.driver.execute_script("window.scrollTo(0,103.7037124633789)")
    self.driver.find_element(By.CSS_SELECTOR, ".o-article__meta:nth-child(2) .o-article__section-tag").click()
    self.driver.find_element(By.CSS_SELECTOR, ".home-link > .dark-logo").click()
    self.driver.find_element(By.CSS_SELECTOR, ".o-article:nth-child(2) > .o-article__right > .o-article__headline > a").click()
    self.driver.find_element(By.CSS_SELECTOR, ".home-link > .dark-logo").click()
    self.driver.execute_script("window.scrollTo(0,60.000003814697266)")
    self.driver.find_element(By.CSS_SELECTOR, ".c-homepage__section:nth-child(1) > .section > a").click()
    self.driver.find_element(By.CSS_SELECTOR, ".c-homepage__section:nth-child(1) .o-article:nth-child(1) > .o-article__meta a").click()
    self.driver.find_element(By.CSS_SELECTOR, ".home-link > .dark-logo").click()
    self.driver.execute_script("window.scrollTo(0,666.6666870117188)")
    self.driver.find_element(By.CSS_SELECTOR, ".second_footer_menu li:nth-child(6) > a").click()
    self.driver.find_element(By.CSS_SELECTOR, ".home-link > .dark-logo").click()
    self.driver.switch_to.frame(5)

  def __init__(self, browser_name):
    self.browser_name = browser_name

