function expand_tile(tile_id){
    let tile = document.getElementById(tile_id);
    let additionalContent = tile.querySelector("#additionalContent");

    if (additionalContent.classList.contains("expanded-info")) {
        additionalContent.classList.remove("expanded-info");
        additionalContent.style.maxHeight = null;
    } else {
        additionalContent.classList.add("expanded-info");
        additionalContent.style.maxHeight = additionalContent.scrollHeight + "px";
    }
}

function stopPropagation(event) {
    event.stopPropagation();
}

function updateToPay(saleId, basePrice) {
    const quantityInput = document.getElementById(saleId);
    const toPaySpan = document.getElementById("to_pay_" + saleId);
    const quantity = parseFloat(quantityInput.value)*1000;
    if (!isNaN(quantity)) {
        let totalPrice = basePrice * quantity;
        totalPrice = totalPrice % 1 === 0 ? totalPrice.toFixed(0) : totalPrice.toFixed(2);
        toPaySpan.textContent = `(${totalPrice} ¤)`;
    }else{
      toPaySpan.textContent = `(0 ¤)`;
    }
}
