function addToast(message) {
    document.getElementById("toasts").innerHTML += `
        <div class="toast message medium">
            <i class="fa fa-info-circle info-circle"></i>
            <div class="txt_center">${message}</div>
            <span onclick="this.parentElement.style.display='none'" class="cross">&times;</span>
        </div>
        `;
}

function addError(message) {
    document.getElementById("toasts").innerHTML += `
        <div class="toast error medium">
            <i class="fa fa-exclamation-circle exclamation-circle"></i>
            <div class="txt_center">${message}</div>
            <span onclick="this.parentElement.style.display='none'" class="cross">&times;</span>
        </div>
        `;
}

let isSubscribed = false;
let swRegistration = null;


if ('serviceWorker' in navigator && 'PushManager' in window) {
    navigator.serviceWorker.register('/static/service-worker.js')
    .then(function(registration) {
        swRegistration = registration;
        update_switch();
    }).catch(function(error) {
        console.error('Service Worker registration failed:', error);
    });
}else{
    const browserNotification = document.getElementById('web_push_notification_switch');
    browserNotification.innerHTML = "Browser notifications not supported";
}

function update_switch(){
    const checkbox = document.getElementById('web_push_notifications-checkbox');

    checkbox.addEventListener('change', function() {
        if (this.checked) {
            requestNotificationPermission();
        } else {
            unsubscribeUserFromPush();
        }
    });

    swRegistration.pushManager.getSubscription()
    .then(function(subscription) {
        isSubscribed = !(subscription === null);
        if (isSubscribed) {
            checkbox.checked = true;
        }
    });
};

function requestNotificationPermission() {
    Notification.requestPermission().then(function(permission) {
        if (permission === 'granted') {
            subscribeUserToPush();
        }
    });
}

function subscribeUserToPush() {
    const publicVapidKey = sessionStorage.getItem('applicationServerPublicKey');
    const convertedVapidKey = urlBase64ToUint8Array(publicVapidKey);

    swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey

    }).then(function(subscription) {

        // Send subscription to your server
        fetch('/subscribe', {
            method: 'POST',
            body: JSON.stringify(subscription),
            headers: {
                'Content-Type': 'application/json'
            }
        }).then((response) => {
            response.json().then((raw_data) => {
                let response = raw_data["response"];
                if (response == "Subscription successful") {
                    isSubscribed = true;
                }else{
                    addError("Browser notification subscription not possible");
                }
            });
        });
    }).catch(function(error) {
        console.error('Failed to subscribe user:', error);
    });
}

function unsubscribeUserFromPush() {
    swRegistration.pushManager.getSubscription().then(function(subscription) {
        if (subscription) {
            subscription.unsubscribe().then(function() {
                // notify the server about the unsubscription
                fetch('/unsubscribe', {
                    method: 'POST',
                    body: JSON.stringify(subscription),
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
            }).catch(function(error) {
                console.error('Failed to unsubscribe user:', error);
            });
        }
    });
}

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}