function change_prices() {
    const inputElements = document.querySelectorAll("input");
    let prices = {};
    inputElements.forEach((input) => {
        if ((input.id == "invite_player") || (input.id == "network_name") || (input.id == "web_push_notifications-checkbox")) {
            return;
        }
        prices[input.id] = float(input.value);
    });
    send_form("/api/change_network_prices", {
        prices: prices,
    })
        .then((response) => {
            response.json().then((raw_data) => {
                let response = raw_data["response"];
                if (response == "success") {
                    addToast("Changes saved");
                    return;
                } 
                if (response == "priceTooLow") {
                    addError("Prices need to be greater than -5");
                }
            });
        })
        .catch((error) => {
            console.error("Error:", error);
        });
}
