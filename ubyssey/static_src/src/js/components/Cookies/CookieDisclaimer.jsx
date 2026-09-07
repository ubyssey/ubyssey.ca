import React from 'react'
import Cookies from 'js-cookie'

class CookieDisclaimer extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      showCookieDisclaimer: true,
    }
  }

  getCookieName() {
    return 'ubyssey_cookie_disclaimer'
  }

  setCookie() {
    Cookies.set(
      this.getCookieName(),
      'accepted',
      { expires: 365, path: '/' }
    )
  }

  disableCookieDisclaimer() {
    this.setCookie()
    this.setState({
      showCookieDisclaimer: false
    })
  }

  componentDidMount() {
    const accepted = Cookies.get(this.getCookieName())

    if (!navigator.cookieEnabled || accepted) {
      this.setState({
        showCookieDisclaimer: false
      })
    }
  }

  render() {
    return (
      <div>
        { this.state.showCookieDisclaimer &&
          <div className='cookie-disclaimer-wrapper'>
            <div className='cookie-disclaimer-container'>
              <h3>Cookies on ubyssey.ca</h3>
              <div className='c-row'>
                <div>
                  <p style={{paddingBottom: '8px'}}>
                    <i>The Ubyssey</i> uses one cookie — <a href="https://developer.mozilla.org/en-US/docs/Web/Security/Attacks/CSRF">a CSRF token</a> — solely to prevent bad actors from performing a cross-site request forgery attack. 
                    When you encounter an error, we record information about <a href="https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/User-Agent">your device and your browser</a> to help us diagnose it. This is the same information your device sends to every website when it requests a webpage. 
                    The information we record is only availible to the Senior System Developers, the Senior Editorial Designer, Digital and the designated staff developers who are fixing the error.
                  </p>
                  <p style={{paddingBottom: '8px'}}>  
                    <i>The Ubyssey</i> doesn't use cookies to track how you use our website or monitor your reading between sessions. We don't share or sell your data.
                  </p>
                  <p>
                    However, we use Google Ads to serve occassional paid advertisements sold by our Business Office. 
                    Google Ads uses six cookies to determine how you engage with ads on our site. The company uses the data it receives from Google Ads to
                    track your browsing habits across the internet. If you have a Google account, you can <a href="https://myactivity.google.com/u/0/activitycontrols/webandapp">limit tracking here.</a> 
                  </p>
                </div>
                <button
                  className='c-button c-button--small'
                  onClick={() => {this.disableCookieDisclaimer()}}
                  >Continue</button>
              </div>
            </div>
          </div>
        }
      </div>
    )
  }
}

export default CookieDisclaimer
