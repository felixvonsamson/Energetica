var socket = io();

socket.on('connect', function() {
    socket.emit('give_identity');
});

function start_construction(building) {
    socket.emit('start_construction', building);
}