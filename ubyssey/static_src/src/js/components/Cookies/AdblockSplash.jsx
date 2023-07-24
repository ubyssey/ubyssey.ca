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
          <div class='adblock-container'>
		
          <div class="alert-symbols-buttons">
            <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80" class="alert-symbol" fill="none">
              <g clip-path="url(#clip0_1_3)">
                <rect width="80" height="80" fill="white"/>
                <path d="M40 75C30.7174 75 21.815 71.3125 15.2513 64.7487C8.68749 58.185 5 49.2826 5 40C5 30.7174 8.68749 21.815 15.2513 15.2513C21.815 8.68749 30.7174 5 40 5C49.2826 5 58.185 8.68749 64.7487 15.2513C71.3125 21.815 75 30.7174 75 40C75 49.2826 71.3125 58.185 64.7487 64.7487C58.185 71.3125 49.2826 75 40 75ZM40 80C50.6087 80 60.7828 75.7857 68.2843 68.2843C75.7857 60.7828 80 50.6087 80 40C80 29.3913 75.7857 19.2172 68.2843 11.7157C60.7828 4.21427 50.6087 0 40 0C29.3913 0 19.2172 4.21427 11.7157 11.7157C4.21427 19.2172 0 29.3913 0 40C0 50.6087 4.21427 60.7828 11.7157 68.2843C19.2172 75.7857 29.3913 80 40 80Z" fill="#0071C9"/>
                <path d="M35.01 55C35.01 54.3434 35.1393 53.6932 35.3906 53.0866C35.6419 52.48 36.0102 51.9288 36.4745 51.4645C36.9388 51.0002 37.49 50.6319 38.0966 50.3806C38.7032 50.1293 39.3534 50 40.01 50C40.6666 50 41.3168 50.1293 41.9234 50.3806C42.53 50.6319 43.0812 51.0002 43.5455 51.4645C44.0098 51.9288 44.3781 52.48 44.6294 53.0866C44.8807 53.6932 45.01 54.3434 45.01 55C45.01 56.3261 44.4832 57.5979 43.5455 58.5355C42.6079 59.4732 41.3361 60 40.01 60C38.6839 60 37.4122 59.4732 36.4745 58.5355C35.5368 57.5979 35.01 56.3261 35.01 55ZM35.5 24.975C35.4334 24.3442 35.5002 23.7065 35.696 23.1031C35.8918 22.4998 36.2123 21.9444 36.6366 21.4729C37.0609 21.0015 37.5796 20.6245 38.1591 20.3664C38.7385 20.1084 39.3657 19.975 40 19.975C40.6343 19.975 41.2615 20.1084 41.8409 20.3664C42.4204 20.6245 42.9391 21.0015 43.3634 21.4729C43.7877 21.9444 44.1082 22.4998 44.304 23.1031C44.4998 23.7065 44.5666 24.3442 44.5 24.975L42.75 42.51C42.6912 43.1989 42.376 43.8406 41.8668 44.3082C41.3576 44.7758 40.6914 45.0353 40 45.0353C39.3086 45.0353 38.6425 44.7758 38.1332 44.3082C37.624 43.8406 37.3088 43.1989 37.25 42.51L35.5 24.975Z" fill="#0071C9"/>
              </g>
              <defs>
                <clipPath id="clip0_1_3">
                <rect width="80" height="80" fill="white"/>
                </clipPath>
              </defs>
            </svg>
          </div>
          
          <div className='adblock-content'>
            <h1 class="adblock-title">Enjoying the Ubyssey?</h1>
            <div class="adblock-info" style="width: 100%; text-align: center">
              <span class="adblock-info">Ads help <span class="adblock-info-the_ubyssey">The Ubyssey </span>bring you <span class="adblock-info-bold">quality content </span>and <span class="adblock-info-bold">tell stories that matter</span>.
                <br/><br/>
                Please <span class="adblock-info-bold">disable </span> adblock or <span class="adblock-info-bold">whitelist </span>ubyssey.ca
                <br/><br/>
                <span class="adblock-info-blue-bold">Please support our student newspaper.</span>
              </span>
            </div>
          </div>
      
          <div class="alert-symbols-buttons">
            <button class='adblock-button' onClick={() => this.disableSplash()}>
              Thank You!
            </button>
          </div>
          
          <div
              className='adblock-close'
              onClick={() => this.setState({showSplash: false})}>
          </div>
          </div>
        }
        </div>
  )
  }
}

export default AdblockSplash
