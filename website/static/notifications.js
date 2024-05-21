function delete_notification(element, notification_id){
  element.parentElement.parentElement.style.display='none';
  document.getElementById("notification_"+notification_id).style.display='none';
  send_form("/api/request_delete_notification", {
    id: notification_id,
  })
  .catch((error) => {
      console.error(`caught error ${error}`);
  });
}

function read_notifications(){
  document.getElementById("notification_list-small").innerHTML = "";
  badge = document.getElementById("unread_badge");
  if(badge){
    badge.style.display='none';
  }
  document.getElementById('notification_popup').classList.add('hidden');
  fetch("/api/request_marked_as_read")
  .catch((error) => {
      console.error(`caught error ${error}`);
  });
}