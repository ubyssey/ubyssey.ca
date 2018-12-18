import DispatchAPI from './api/dispatch'
import Cookies from 'js-cookie'

const applicationServerPublicKey =
  'BOValqIGLJdBIl-qoqRvhPKIa4YxQYDBJsrTCdi7JTVKXGcMpPi6lI26M7s2nteLhAj8zBjDqi40B_vl7Re_iyE'

let isSubscribed = false
let swRegistration = null

function urlB64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

const cookieName = 'notification_subscription'

function getCookie(field) {
  let cookie = Cookies.get(cookieName)
  if (typeof cookie === 'string' && cookie !== '') {
    cookie = JSON.parse(cookie)
    if (field) {
      return cookie[field]
    }
    return cookie
  }
  return cookie
}

function setCookie(uuid) {
  Cookies.set(cookieName, { uuid: uuid }, { path: '/' })
}

function updateSubscriptionOnServer(subscription) {
  const uuid = getCookie('uuid')
  if (subscription && uuid) {
    DispatchAPI.notifications.updateSubscription(uuid, subscription)
  } else if (subscription) {
    DispatchAPI.notifications.subscribe(subscription).then(response => {
      setCookie(response.id)
    })
  }
}

function subscribeUser() {
  const applicationServerKey = urlB64ToUint8Array(applicationServerPublicKey)
  swRegistration.pushManager
    .subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey
    })
    .then(function(subscription) {
      updateSubscriptionOnServer(subscription)

      isSubscribed = true
    })
    .catch(function(err) {
      console.error('Failed to subscribe the user: ', err)
    })
}

export function initializeUI(swReg) {
  swRegistration = swReg
  subscribeUser()

  // Set the initial subscription value
  swRegistration.pushManager.getSubscription().then(function(subscription) {
    isSubscribed = !(subscription === null)

    updateSubscriptionOnServer(subscription)

    if (!isSubscribed) {
      console.warn('User is NOT subscribed.')
    }
  })
}
