import React from 'react'
import Cookies from 'js-cookie'

class AdBlockSplash extends React.Component {
  constructor(props){
    super(props)
    this.state = {
      showAdvertisementSplash: true,
      showSubscribeSplash: true
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

  setCookie(visitCount, enableAdvertisementSplash, enableSubscribeSplash) {
    Cookies.set(
      this.getCookieName(),
      {'visitCount': visitCount, 'enableAdvertisementSplash': enableAdvertisementSplash, 'enableSubscribeSplash': enableSubscribeSplash},
      { expires: 90, path: '/' }
    )
  }

  disableAdvertisementSplash() {
    const visitCount = this.getCookie('visitCount')
    const enableSubscribeSplash = this.getCookie('enableSubscribeSplash')

    this.setState({
      showAdvertisementSplash: false,
      enableAdvertisementSplash: false
    })
    this.setCookie(visitCount, false, enableSubscribeSplash)
  }

  disableSubscribeSplash() {
    const visitCount = this.getCookie('visitCount')
    const enableAdvertisementSplash = this.getCookie('enableAdvertisementSplash')
    this.setState({
      showSubscribeSplash: false,
    })
    this.setCookie(visitCount, enableAdvertisementSplash, false)
  }

  componentDidMount() {
    const visitCount = this.getCookie('visitCount')
    const enableAdvertisementSplash = this.getCookie('enableAdvertisementSplash')
    const enableSubscribeSplash = this.getCookie('enableSubscribeSplash')

    if (typeof(visitCount) !== 'number') {
      this.setCookie(1, true, true)
    } else{
      this.setCookie(visitCount + 1, enableAdvertisementSplash, enableSubscribeSplash)
    }
    // cookies are disabled or visited more than 3 times without disabling splash
    if (!navigator.cookieEnabled) {
      this.setState({ showAdvertisementSplash: true, showSubscribeSplash: true })
    } else{
      if (visitCount%2 == 0 && enableAdvertisementSplash) {
        this.setState({ showAdvertisementSplash: true }) 
      } else {
        this.setState({ showAdvertisementSplash: false })
      }
    }
  }

  render() {
    return (
      <div>
        { this.state.showAdvertisementSplash &&
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
                  onClick={() => this.disableAdvertisementSplash()}>
                  Don't ask again
                </button>
                <div
                  className='adblock-close'
                  onClick={() => this.setState({showAdvertisementSplash: false})}>
                  </div>
              </div>
            </div>
        }
      </div>
    )
  }
}

export default AdBlockSplash