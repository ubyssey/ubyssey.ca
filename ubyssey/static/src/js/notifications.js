import DispatchAPI from './api/dispatch';
import Cookies from 'js-cookie'

const applicationServerPublicKey = 'BL0AJhJ5cnCGuRc6SLH_WEX1FvUczLQjPyyDs615ZFPrOaxxMETNBrg4mi87yZfEBkux_oLs5S91djPXgU-2tQQ';

let subscribed = false;

function urlB64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
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
  Cookies.set(
    cookieName,
    { uuid: uuid },
    { path: '/'  }
  )
}

function updateSubscriptionOnServer(subscription) {
  const uuid = getCookie('uuid')
  if (subscription && uuid) {
    DispatchAPI.notifications.updateSubscription(uuid, subscription)
  } else if (subscription) {
    DispatchAPI.notifications.subscribe(subscription)
    .then ( (response) => {
      setCookie(response.id)
    })
  }
}

function subscribeUser(swReg) {
  const applicationServerKey = urlB64ToUint8Array(applicationServerPublicKey);
  swReg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: applicationServerKey
  })
  .then(function(subscription) {
    updateSubscriptionOnServer(subscription);

    subscribed = true;
  })
  .catch(function(err) {
    console.error('Failed to subscribe the user: ', err);
  });
}

export function initializeUI(swReg) {
  subscribeUser(swReg)

  // Set the initial subscription value
  swReg.pushManager.getSubscription()
  .then(function(subscription) {
    subscribed = !(subscription === null);
    
    updateSubscriptionOnServer(subscription);

    if (!subscribed) {
      console.warn('User is NOT subscribed.');
    } else {
      console.warn('User IS subscribed');
    }
  });
}