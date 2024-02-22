function change_prices() {
    const inputElements = document.querySelectorAll("input");
    let prices = {};
    let SCPs = {};
    inputElements.forEach((input) => {
        if ((input.id == "invite_player") | (input.id == "network_name")) {
            return;
        }
        prices[input.id] = float(input.value);
    });
    send_form("/change_network_prices", {
        prices: prices,
    })
        .then((response) => {
            response.json().then((raw_data) => {
                addToast("Changes saved");
            });
        })
        .catch((error) => {
            console.error("Error:", error);
        });
}
