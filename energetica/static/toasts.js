function addToast(message) {
    const toasts = document.getElementById("toasts");
    if (toasts === null) {
        console.error('Toast container not found');
        return;
    }
    toasts.innerHTML += `
        <div class="toast message medium">
            <i class="fa fa-info-circle info-circle"></i>
            <div class="txt_center">${message}</div>
            <span onclick="this.parentElement.style.display='none'" class="cross">&times;</span>
        </div>
        `;
}

function addError(message) {
    const toasts = document.getElementById("toasts");
    if (toasts === null) {
        console.error('Toast container not found');
        return;
    }
    toasts.innerHTML += `
        <div class="toast error medium">
            <i class="fa fa-exclamation-circle exclamation-circle"></i>
            <div class="txt_center">${message}</div>
            <span onclick="this.parentElement.style.display='none'" class="cross">&times;</span>
        </div>
        `;
}

let isSubscribed = false;
/** @type {ServiceWorkerRegistration | null} */
let swRegistration = null;


if ('serviceWorker' in navigator && 'PushManager' in window) {
    navigator.serviceWorker.register('/static/service-worker.js')
        .then(function (registration) {
            swRegistration = registration;
            update_switch();
        }).catch(function (error) {
            console.error('Service Worker registration failed:', error);
        });
} else {
    const browserNotification = document.getElementById('web_push_notification_switch');
    if (browserNotification) {
        browserNotification.innerHTML = "Browser notifications not supported";
    }
}

function update_switch() {
    /** @type {HTMLInputElement | null} */
    // @ts-ignore
    const checkbox = document.getElementById('web_push_notifications-checkbox');

    if (checkbox === null) {
        return;
    }
    checkbox.addEventListener('change', function () {
        if (this.checked) {
            requestNotificationPermission();
        } else {
            unsubscribeUserFromPush();
        }
    });
    if (swRegistration == null) {
        console.error('Service Worker registration not ready');
        return;
    }
    swRegistration.pushManager.getSubscription()
        .then(function (subscription) {
            isSubscribed = !(subscription === null);
            if (isSubscribed) {
                checkbox.checked = true;
            }
        });
};

function requestNotificationPermission() {
    Notification.requestPermission().then(function (permission) {
        if (permission === 'granted') {
            subscribeUserToPush();
            let notification_settings = document.getElementById('notification_settings_list');
            if (notification_settings) {
                notification_settings.classList.remove('collapsed');
            }
        } else {
            addError("Notification permission denied");
        }
    });
}

function subscribeUserToPush() {
    const publicVapidKey = sessionStorage.getItem('applicationServerPublicKey');
    if (publicVapidKey === null) {
        addError("Public VAPID key not found");
        return;
    }
    const convertedVapidKey = urlBase64ToUint8Array(publicVapidKey);

    if (swRegistration === null) {
        console.error('Service Worker registration not ready');
        return;
    }
    swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey
    }).then(function (subscription) {
        // Send subscription to your server
        fetch('/api/v1/browser-notifications:subscribe', {
            method: 'POST',
            body: JSON.stringify(subscription),
            headers: {
                'Content-Type': 'application/json'
            }
        }).then((response) => {
            if (response.ok) {
                isSubscribed = true;
            } else {
                addError("Browser notification subscription failed");
            }
        });
    }).catch(function (error) {
        console.error('Failed to subscribe user:', error);
    });
}

function unsubscribeUserFromPush() {
    if (swRegistration === null) {
        console.error('Service Worker registration not ready');
        return;
    }
    swRegistration.pushManager.getSubscription().then(function (subscription) {
        if (subscription) {
            subscription.unsubscribe().then(function () {
                // notify the server about the unsubscription
                fetch('/api/v1/browser-notifications:unsubscribe', {
                    method: 'POST',
                    body: JSON.stringify(subscription),
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                let notification_settings = document.getElementById('notification_settings_list');
                if (notification_settings) {
                    notification_settings.classList.add('collapsed');
                }
            }).catch(function (error) {
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