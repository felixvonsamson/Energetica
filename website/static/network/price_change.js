function change_prices() {
    const inputElements = document.querySelectorAll("input");
    let prices = {};
    let SCPs = {};
    inputElements.forEach((input) => {
        if ((input.id == "invite_player") | (input.id == "network_name")) {
            return;
        }
        if (input.type == "checkbox") {
            SCPs[input.id] = input.checked;
        } else {
            prices[input.id] = float(input.value);
        }
    });
    fetch("/change_network_prices", {
        method: "POST",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            prices: prices,
            SCPs: SCPs,
        }),
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
