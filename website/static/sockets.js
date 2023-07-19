/* 
This code contains the main functions that communicate with the server (client side)
*/

var socket = io();

socket.on('connect', function() {
    socket.emit('give_identity');
});

// information sent to the server when a new building is created
function start_construction(building, family) {
    socket.emit('start_construction', building, family);
}

// updates specific fields of the page without reloading
socket.on('update_data', function(changes) {
    for (i = 0; i < changes.length; i++) {
        object_id = changes[i][0];
        value = changes[i][1];
        var obj = document.getElementById(object_id);
        if (obj != null) { obj.innerHTML = value; }
    }
});

// reloads the page
socket.on('refresh', function() {
    window.location = window.location;
});