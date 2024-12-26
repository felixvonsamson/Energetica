const sortableList = document.querySelector(".priority_list");

const storageFacilities = [
    "small_pumped_hydro",
    "molten_salt",
    "large_pumped_hydro",
    "hydrogen_storage",
    "lithium_ion_batteries",
    "solid_state_batteries",
];

let renewables;

const initSortableList = (e) => {
    e.preventDefault();
    const draggingItem = document.querySelector(".dragging");
    if (!draggingItem.draggable) {
        return;
    }
    const sortableListRect = sortableList.getBoundingClientRect();
    let offsetY = e.clientY - sortableListRect.top;
    if (!offsetY) {
        offsetY = e.touches[0].clientY - sortableListRect.top;
    }
    let siblings = [...sortableList.querySelectorAll(".item:not(.dragging)")].filter(item => item.draggable);

    // Finding the sibling after which the dragging item should be placed
    let nextSibling = siblings.find(sibling => {
        const siblingRect = sibling.getBoundingClientRect();
        const siblingOffsetY = siblingRect.top - sortableListRect.top; // Adjust for scroll position
        return offsetY <= siblingOffsetY + sibling.offsetHeight / 2;
    });

    // Inserting the dragging item before the found sibling
    sortableList.insertBefore(draggingItem, nextSibling);

    reset_icons();
    siblings = [...sortableList.querySelectorAll(".item:not(.dragging)")];
    siblings.forEach(sibling => {
        const siblingRect = sibling.getBoundingClientRect();
        const siblingOffsetY = siblingRect.top - sortableListRect.top + sibling.offsetHeight / 2;
        if (draggingItem.classList.contains('gen') && sibling.classList.contains('cons')) {
            const icon = sibling.querySelector("#priority_list_icon");
            icon.classList.remove('fa-sort');
            icon.classList.remove('fa-lock');
            if (siblingOffsetY > offsetY) {
                icon.classList.add('fa-bolt');
                icon.classList.add('txt-pine');
            } else {
                sibling.classList.add('dimmed');
                icon.classList.add('fa-times');
                icon.classList.add('txt-red');
            }
        }
        if (draggingItem.classList.contains('cons') && sibling.classList.contains('gen')) {
            const icon = sibling.querySelector("#priority_list_icon");
            icon.classList.remove('fa-sort');
            if (siblingOffsetY > offsetY) {
                sibling.classList.add('dimmed');
                icon.classList.add('fa-times');
                icon.classList.add('txt-red');
            } else {
                icon.classList.add('fa-bolt');
                icon.classList.add('txt-pine');
            }
        }
    });
};

function send_new_list() {
    new_priority = [];
    sortableList.childNodes.forEach(item => {
        if (item.draggable) {
            new_priority.push(item.id);
        }
    });
    send_json("/api/request_change_facility_priority", {
        priority: new_priority,
    }).catch((error) => {
        console.error(`caught error ${error}`);
        // TODO(mglst): error is possible if new data arrives before the old data is saved
    });
}

if (sortableList) {
    fetch("/api/get_generation_priority")
        .then((response) => response.json())
        .then((raw_data) => {
            load_const_config().then((const_config) => {
                renewables = raw_data[0];
                for (facility of raw_data[0]) {
                    console.log(facility, const_config.assets[facility]);
                    let name = const_config.assets[facility].name;
                    sortableList.innerHTML += `<li class="item medium gen" style="margin-left:2.1em;" id="${facility}">
                <div class="details padding">
                <span>${name}</span>
                </div>
                <i id="priority_list_icon" class="fa fa-lock priority_list_icon"></i>
            </li>`;
                }
                for (facility of raw_data[1]) {
                    let name;
                    let generation = true;
                    if (storageFacilities.includes(facility)) {
                        name = const_config.assets[facility].name + " (discharge)";
                    } else if (facility.includes("demand-")) {
                        generation = false;
                        if (storageFacilities.includes(facility.slice(7))) {
                            name = const_config.assets[facility.slice(7)].name + " (charge)";
                        } else if (facility.slice(7) in const_config.assets) {
                            name = const_config.assets[facility.slice(7)].name;
                        } else if (facility == "buy_transport") {
                            name = "Shipments";
                        } else {
                            name = facility.charAt(7).toUpperCase() + facility.slice(8);
                        }
                    } else {
                        name = const_config.assets[facility].name;
                    }
                    if (generation) {
                        sortableList.innerHTML += `<li class="item medium draggable gen" draggable="true" id="${facility}">
                        <div class="details padding">
                        <span>${name}</span>
                        </div>
                        <i id="priority_list_icon" class="fa fa-sort priority_list_icon"></i>
                        </li>`;
                    } else {
                        sortableList.innerHTML += `<li class="item medium draggable cons" draggable="true" id="${facility}">
                        <i id="priority_list_icon" class="fa fa-sort priority_list_icon"></i>
                        <div class="details padding">
                        <span>${name}</span>
                        </div>
                        </li>`;
                    }
                }
                const items = sortableList.querySelectorAll(".item");
                items.forEach(item => {
                    item.addEventListener("dragstart", () => item.classList.add("dragging"));
                    item.addEventListener("dragend", () => {
                        item.classList.remove("dragging");
                        send_new_list();
                        reset_icons();
                    });
                    item.addEventListener("touchstart", () => item.classList.add("dragging"));
                    item.addEventListener("touchend", () => {
                        item.classList.remove("dragging");
                        send_new_list();
                        reset_icons();
                    });
                });
            });
        })
        .catch((error) => {
            console.error(`caught error ${error}`);
        });

    sortableList.addEventListener("dragover", initSortableList);
    sortableList.addEventListener("dragenter", e => e.preventDefault());
    sortableList.addEventListener("touchmove", initSortableList);
    sortableList.addEventListener("touchenter", e => e.preventDefault());
}

function reset_icons() {
    let icons = document.querySelectorAll("#priority_list_icon");
    icons.forEach(icon => {
        icon.parentElement.classList.remove('dimmed');
        icon.classList.remove('fa-times');
        icon.classList.remove('fa-bolt');
        icon.classList.remove('txt-pine');
        icon.classList.remove('txt-red');
        if (renewables.includes(icon.parentElement.id)) {
            icon.classList.add('fa-lock');
        } else {
            icon.classList.add('fa-sort');
        }
    });
}

function change_prices() {
    const priceInputs = Array.from(document.querySelectorAll("input")).filter(input => input.id.includes("price-"));

    let prices = { "supply": {}, "demand": {} };
    priceInputs.forEach((input) => {
        let price_type = input.id.split("-")[1];
        let facility = input.id.split("-")[2];
        prices[price_type][facility] = parseFloat(input.value);
    });
    send_json("/api/change_network_prices", {
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
                    return;
                }
                addError("This is a frustrating message telling you that something went wrong but not what");
            });
        })
        .catch((error) => {
            console.error("Error:", error);
        });
}
