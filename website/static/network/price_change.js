function change_prices(){
    const inputElements = document.querySelectorAll('input');
    let prices = {};
    let SCPs = {};
    inputElements.forEach(input => {
        if (input.id == "invite_player" | input.id == "network_name"){
            return
        }
        if (input.type == "checkbox"){
            SCPs[input.id] = input.checked;
        }else{
            prices[input.id] = input.value;
        }
    });
    socket.emit("change_price", prices, SCPs);
}