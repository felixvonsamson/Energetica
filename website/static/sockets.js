/* 
This code contains the main functions that communicate with the server (client side)
*/


socket.on('connect', function() {
    console.log("Connected to server");
    socket.emit('give_identity');
});

// information sent to the server when a new facility is created
function start_construction(facility, family) {
    socket.emit('start_construction', facility, family);
}

socket.on('display_under_construction', function(facility, finish_time) {
    var uc = document.getElementById("under_construction");
    uc.innerHTML += '<div class="padding" id="progress_bar">The facility \
    <b>' + facility + '</b> is under construction <i class="time" \
    data-name="' + finish_time + '"></i></div>'
});

// updates specific fields of the page without reloading
socket.on('update_data', function(changes) {
    for (i = 0; i < changes.length; i++) {
        object_id = changes[i][0];
        value = changes[i][1];
        var obj = document.getElementById(object_id);
        if (obj != null) { obj.innerHTML = value; }
    }
});

socket.on('display_new_message', function(msg) {
    var obj = document.getElementById("messages_field");
    if (obj != null) { obj.innerHTML += msg; }
});

// reloads the page
socket.on('refresh', function() {
    window.location = window.location;
});