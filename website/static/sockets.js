var socket = io();

socket.on('connect', function() {
    socket.emit('give_identity');
});

function start_construction(building) {
    socket.emit('start_construction', building);
}

socket.on('message', function(message_id, category, message) {
    hiding_code = (message_id != null) ? `hide_message(${message_id})` : '';
    if (category == 'message') {
        document.getElementById('messages').innerHTML += `
          <div class="toast message padding small">
            <i class="fa fa-info-circle info-circle"></i>
            <div class="txt_center">${message}</div>
            <span onclick="this.parentElement.style.display='none'; ${hiding_code}" class="cross">&times;</span>
          </div>
          `;
    } else if (category == 'error') {
        document.getElementById('messages').innerHTML += `
          <div class="toast error padding small">
            <i class="fa fa-exclamation-circle exclamation-circle"></i>
            <div class="txt_center">${message}</div>
            <span onclick="this.parentElement.style.display='none'; ${hiding_code}" class="cross">&times;</span>
          </div>
          `;
    }
});