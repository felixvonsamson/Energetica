var socket = io();

function start_construction(building) {
    socket.emit('start_construction', building);
}