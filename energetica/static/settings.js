// document.addEventListener('DOMContentLoaded', function () {
//   const inputs = document.querySelectorAll('input[id^="web_push_notifications-"]');

//   inputs.forEach(input => {
//     input.addEventListener('change', function (event) {
//       const id = event.target.id;
//       const checked = event.target.checked;

//       if (id === 'web_push_notifications-checkbox') {
//         if (checked) {
//           subscribe_to_notifications();
//         } else {
//           unsubscribe_from_notifications();
//         }
//       } else {
//         const type = id.split('-')[1];
//         const data = {};
//         data[type] = checked;

//         fetch('/api/set_notification_preferences', {
//           method: 'POST',
//           headers: {
//             'Content-Type': 'application/json'
//           },
//           body: JSON.stringify(data)
//         }).then(response => {
//           if (!response.ok) {
//             console.error('Failed to set notification preferences');
//           }
//         }).catch(error => {
//           console.error('Error:', error);
//         });
//       }
//     });
//   });
// });

// function subscribe_to_notifications() {
//   // Implementation for subscribing to notifications
//   console.log('Subscribed to notifications');
// }

// function unsubscribe_from_notifications() {
//   // Implementation for unsubscribing from notifications
//   console.log('Unsubscribed from notifications');
// }