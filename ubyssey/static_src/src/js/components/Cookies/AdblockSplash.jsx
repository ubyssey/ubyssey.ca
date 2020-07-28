import React from 'react'
import Cookies from 'js-cookie'

class AdblockSplash extends React.Component {
  constructor(props){
    super(props)
    this.state = {
      showSplash: true,
    }
  }

  getCookieName() {
    return 'ubyssey_site_visit'
  }

  getCookie(field) {
    let cookie = Cookies.get(this.getCookieName())
    if (typeof cookie === 'string' && cookie !== '') {
      cookie = JSON.parse(cookie)
      if (field) {
        return cookie[field]
      }
      return cookie
    }
    return cookie
  }

  setCookie(visitCount, enableSplash) {
    Cookies.set(
      this.getCookieName(),
      {'visitCount': visitCount, 'enableSplash': enableSplash},
      { expires: 365, path: '/' }
    )
  }

  disableSplash() {
    const visitCount = this.getCookie('visitCount')
    this.setCookie(visitCount, false)
    this.setState({
      showSplash: false
    })
  }

  componentDidMount() {
    const visitCount = this.getCookie('visitCount')
    const enableSplash = this.getCookie('enableSplash') ? true : false

    if (typeof(visitCount) !== 'number') {
      this.setCookie(2, true)
    } else{
      this.setCookie(visitCount + 1, enableSplash)
    }
    // cookies are disabled or visited more than 3 times without disabling splash
    if (!navigator.cookieEnabled || (visitCount >= 3 && enableSplash)) {
      this.setState({
        showSplash: true
      })
    } else{
      this.setState({
        showSplash: false
      })
    }
  }

  render() {
    return (
      <div>
        { this.state.showSplash &&
          <div className='adblock-container'>
            <div className='adblock-fullscreen' />
            <div className='adblock-content'>
              <h1>Enjoying the Ubyssey?</h1>
              <p>We know you don't come here for the ads. Ads help The Ubyssey bring you quality content and tell the stories that matter. Support your student newspaper.</p>
              <h3>Please disable adblock or whitelist ubyssey.ca</h3>
              { !navigator.cookieEnabled &&
                <em>It looks like you have disabled cookies, the 'Don't ask again' button may not work while cookies are disabled</em>
              }
              <p>Thank you for your support!</p>
              <button
                className='adblock-button'
                onClick={() => this.disableSplash()}>
                Don't ask again
              </button>
              <div
                className='adblock-close'
                onClick={() => this.setState({showSplash: false})}>
                </div>
            </div>
          </div>
        }
      </div>
    )
  }
}

export default AdblockSplash
