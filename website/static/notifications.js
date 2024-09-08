function delete_notification(element, notification_id) {
  element.parentElement.parentElement.style.display = 'none';
  document.getElementById("notification_" + notification_id).style.display = 'none';
  send_form("/api/request_delete_notification", {
    id: notification_id,
  })
    .catch((error) => {
      console.error(`caught error ${error}`);
    });
}

function read_notifications() {
  document.getElementById("notification_list-small").innerHTML = "";
  badge = document.getElementById("unread_badge");
  if (badge) {
    badge.style.display = 'none';
  }
  document.getElementById('notification_popup').classList.add('hidden');
  document.getElementById('web_push_notification_switch').classList.add('hidden');
  fetch("/api/request_marked_as_read")
    .catch((error) => {
      console.error(`caught error ${error}`);
    });
}

function hide_has_dependents() {
  document.getElementById('has_dependents_popup').classList.add('hidden');
}

function has_dependents_cancel_construction(construction_id, dependents) {
  document.getElementById('has_dependents_popup').classList.remove('hidden');
  newInnerHTML = `<table>`;
  console.log(dependents);
  for (let dependent of dependents) {
    console.log(dependent);
    newInnerHTML += `<tr><td>` + dependent[0] + `</td>`;
    newInnerHTML += `<td>level ` + dependent[1] + `</td></tr>`;
  }
  newInnerHTML += `</table>`;
  document.getElementById('has_dependents_content').innerHTML = newInnerHTML;
}

function hide_are_you_sure() {
  document.getElementById('are_you_sure_popup').classList.add('hidden');
}

function are_you_sure_cancel_construction(construction_id, refund) {
  document.getElementById('are_you_sure_popup').classList.remove('hidden');
  document.getElementById('are_you_sure_content').innerHTML = `Are you sure you want to cancel this construction?<br>
  You will recover ${refund} of the initial cost.`;
  document.getElementById('yes_im_sure').setAttribute('onclick', `cancel_construction(${construction_id}, force=true); hide_are_you_sure()`);
  document.getElementById('no_cancel').innerHTML = '<b>No</b>';
}

function are_you_sure_start_construction(facility, family, capacity, construction_power) {
  document.getElementById('are_you_sure_popup').classList.remove('hidden');
  document.getElementById('are_you_sure_content').innerHTML = `
    This construction will consume ${format_power(construction_power)} but your generation capacity is only ${format_power(capacity)}.<br>
    Are you sure you want to start this construction?`;
  document.getElementById('yes_im_sure').setAttribute('onclick', `start_construction('${facility}', '${family}', force=true); hide_are_you_sure()`);
  document.getElementById('no_cancel').innerHTML = '<b>Cancel</b>';
}