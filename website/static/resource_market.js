function expand_tile(sale_id) {
    let additionalContent = document.getElementById("buyForm_"+sale_id);

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
        toPaySpan.innerHTML = `( ${display_money(parseFloat(totalPrice), write=false)} )`;
    } else {
        toPaySpan.innerHTML = display_money(0, write=false);
    }
}

function buy_resource(saleId){
    let quantity = document.getElementById("buying_quantity_" + saleId).value;
    if (isNaN(quantity) || quantity == "") {
        addError("Please enter a valid quantity");
        return;
    }
    send_form("/api/buy_resource", {"id": saleId, "quantity": quantity})
    .then((response) => {
        response.json().then((raw_data) => {
            let response = raw_data["response"];
            if (response == "success") {
                addToast(`You bought ${display_kg(raw_data["quantity"], write=false)} of ${raw_data["resource"]} from ${raw_data["seller"]} for a total cost of ${display_money(raw_data["total_price"], write=false)}`);
                if(raw_data["available_quantity"] == 0){
                    document.getElementById("tile_" + saleId).remove();
                }else{
                    available_quantity = document.getElementById("available_quantitiy_" + saleId);
                    available_quantity.innerHTML = display_kg(raw_data["available_quantity"], write=false) + raw_data["resource"];
                }
                sessionStorage.setItem(
                    "shipments",
                    JSON.stringify(raw_data["shipments"])
                );
                refresh_progressBar();
            }else if (response == "notEnoughMoney") {
                addError("Not enough money");
            }else if (response == "invalidQuantity") {
                addError("The quantitiy needs to be grater than 0 and cannot exceed the available quantity");
            }else if (response == "removedFromMarket") {
                if(raw_data["available_quantity"] == 0){
                    document.getElementById("tile_" + saleId).remove();
                }else{
                    available_quantity = document.getElementById("available_quantitiy_" + saleId);
                    available_quantity.innerHTML = display_kg(raw_data["available_quantity"], write=false) + raw_data["resource"];
                }
                addToast(`You removed ${display_kg(raw_data["quantity"], write=false)} of ${raw_data["resource"]} from the market`);
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
    form.addEventListener('submit', function(event) {
        event.preventDefault();  // Prevent the default form submission
        if (form.checkValidity()) {
            const saleId = form.getAttribute('id').split('_')[1];
            buy_resource(saleId);
        } else {
            form.reportValidity();
        }
    });
});