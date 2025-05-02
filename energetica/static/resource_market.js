function expand_tile(sale_id) {
    let additionalContent = document.getElementById("buyForm_" + sale_id);

    if (additionalContent.classList.contains("expanded-info")) {
        additionalContent.classList.remove("expanded-info");
        additionalContent.style.maxHeight = null;
    } else {
        additionalContent.classList.add("expanded-info");
        additionalContent.style.maxHeight =
            additionalContent.scrollHeight + "px";
    }
}

function stopPropagation(event) {
    event.stopPropagation();
}

function updateToPay(saleId, basePrice) {
    const quantityInput = document.getElementById("buying_quantity_" + saleId);
    const toPaySpan = document.getElementById("to_pay_" + saleId);
    const quantity = parseFloat(quantityInput.value) * 1000;
    if (!isNaN(quantity)) {
        let totalPrice = basePrice * quantity;
        totalPrice =
            totalPrice % 1 === 0
                ? totalPrice.toFixed(0)
                : totalPrice.toFixed(2);
        toPaySpan.innerHTML = `(total: ${format_money(parseFloat(totalPrice))})`;
    } else {
        toPaySpan.innerHTML = `(total: ${format_money(parseFloat(0))})`;
    }
}

function buy_resource(saleId) {
    let quantity = document.getElementById("buying_quantity_" + saleId).value;
    if (isNaN(quantity) || quantity == "") {
        addError("Please enter a valid quantity");
        return;
    }
    send_json(`/api/v1/resource_market/asks/${saleId}/purchase`, { "quantity": quantity * 1000 })
        .then((response) => {
            response.json().then((raw_data) => {
                if (response.status == 200) {
                    addToast(`Purchase successful`);
                    if (raw_data) {
                        available_quantity = document.getElementById("available_quantity_" + saleId);
                        available_quantity.innerHTML = format_mass(Number(raw_data["quantity"])) + raw_data["resource"];
                    } else {
                        document.getElementById("tile_" + saleId).remove();
                    }
                    sessionStorage.setItem(
                        "shipments",
                        JSON.stringify(raw_data["shipments"])
                    );
                    refresh_progressBar();
                } else if (response.status == 400) {
                    if (raw_data.exception_type == "Not enough money") {
                        addError("Not enough money");
                    } else if (raw_data.exception_type == "invalidQuantity") {
                        addError("The quantity needs to be grater than 0 and cannot exceed the available quantity");
                    } else if (raw_data.exception_type == "removedFromMarket") {
                        if (raw_data["available_quantity"] == 0) {
                            document.getElementById("tile_" + saleId).remove();
                        } else {
                            available_quantity = document.getElementById("available_quantity_" + saleId);
                            available_quantity.innerHTML = format_mass(raw_data["available_quantity"]) + raw_data["resource"];
                        }
                        addToast(`You removed ${format_mass(raw_data["quantity"])} of ${raw_data["resource"]} from the market`);
                    }
                } else {
                    addError("An unknown error occurred");
                }
            });
        })
        .catch((error) => {
            console.error(`caught error ${error}`);
        });
}

// Prevent form submission and handle the submit event manually
const resource_buy_forms = document.querySelectorAll('.additionalContent');
resource_buy_forms.forEach(form => {
    form.addEventListener('submit', function (event) {
        event.preventDefault();  // Prevent the default form submission
        if (form.checkValidity()) {
            const saleId = form.getAttribute('id').split('_')[1];
            buy_resource(saleId);
        } else {
            form.reportValidity();
        }
    });
});

function place_ask(resource, quantity, unit_price) {
    if (isNaN(quantity) || quantity == "") {
        addError("Please enter a valid quantity");
        return;
    }
    if (isNaN(unit_price) || unit_price == "") {
        addError("Please enter a valid price");
        return;
    }
    send_json("/api/v1/resource_market/asks", { "resource_type": resource, "quantity": quantity, "unit_price": unit_price })
        .then((response) => {
            if (response.status == 201) {
                window.location = window.location;
            } else {
                addError("Failed to put resource on sale");
            }
        })
        .catch((error) => {
            console.error(`caught error ${error}`);
        });
}

const place_ask_form = document.getElementById("place_ask_form");
if (place_ask_form) {
    place_ask_form.addEventListener("submit", function (event) {
        event.preventDefault();  // Prevent the default form submission
        if (place_ask_form.checkValidity()) {
            const resource = document.getElementById("resource").value;
            const quantity = Number(document.getElementById("quantity").value) * 1000;
            const unit_price = Number(document.getElementById("price").value) / 1000;
            console.log(resource, quantity, unit_price);
            place_ask(resource, quantity, unit_price);
        } else {
            place_ask_form.reportValidity();
        }
    });
}