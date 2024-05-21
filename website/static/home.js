const sortableList = document.querySelector(".priority_list");

const storageCharging = [
    "buy_small_pumped_hydro",
    "buy_compressed_air",
    "buy_molten_salt",
    "buy_large_pumped_hydro",
    "buy_hydrogen_storage",
    "buy_lithium_ion_batteries",
    "buy_solid_state_batteries",
]

let renewables;

const initSortableList = (e) => {
    e.preventDefault();
    const draggingItem = document.querySelector(".dragging");
    if (!draggingItem.draggable){
        return
    }
    const sortableListRect = sortableList.getBoundingClientRect();
    let offsetY = e.clientY - sortableListRect.top;
    if (!offsetY){
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
        if (draggingItem.classList.contains('gen') && sibling.classList.contains('cons')){
            const icon = sibling.querySelector("#priority_list_icon");
            icon.classList.remove('fa-sort');
            icon.classList.remove('fa-lock');
            if (siblingOffsetY > offsetY) {
                icon.classList.add('fa-bolt');
                icon.classList.add('txt-pine');
            }else{
                sibling.classList.add('dimmed');
                icon.classList.add('fa-times');
                icon.classList.add('txt-red');
            }
        }
        if (draggingItem.classList.contains('cons') && sibling.classList.contains('gen')){
            const icon = sibling.querySelector("#priority_list_icon");
            icon.classList.remove('fa-sort');
            if (siblingOffsetY > offsetY) {
                sibling.classList.add('dimmed');
                icon.classList.add('fa-times');
                icon.classList.add('txt-red');
            }else{
                icon.classList.add('fa-bolt');
                icon.classList.add('txt-pine');
            }
        }
    });
}

function send_new_list(){
    new_priority = [];
    sortableList.childNodes.forEach(item => {
        if (item.draggable){
            new_priority.push(item.id);
        }
    });
    send_form("/request_change_facility_priority", {
        priority: new_priority,
    }).catch((error) => {
            console.error(`caught error ${error}`);
        });
}

if (sortableList){
    fetch("/get_generation_prioirity")
    .then((response) => response.json())
    .then((raw_data) => {
        load_const_config().then((const_config) => {
            renewables = raw_data[0];
            for(facility of raw_data[0]){
                let name = const_config[facility].name;
                sortableList.innerHTML += `<li class="item medium gen" style="margin-left:2.1em;" id="${ facility }">
                <div class="details padding">
                <span>${ name }</span>
                </div>
                <i id="priority_list_icon" class="fa fa-lock priority_list_icon"></i>
            </li>`
            }
            for(facility of raw_data[1]){
                let name;
                let generation = true;
                if (storageCharging.includes(facility)){
                    generation = false;
                    name = const_config[facility.slice(4)].name + " (charge)";
                }else if(storageCharging.includes("buy_" + facility)){
                    name = const_config[facility].name + " (discharge)";
                }else if (facility.includes("buy_")){
                    generation = false;
                    if (facility.slice(4) in const_config){
                        name = const_config[facility.slice(4)].name;
                    }else if(facility == "buy_transport"){
                        name = "Shipments";
                    }else{
                        name = facility.charAt(4).toUpperCase() + facility.slice(5);
                    }
                }else{
                    name = const_config[facility].name;
                }
                if(generation){
                    sortableList.innerHTML += `<li class="item medium draggable gen" draggable="true" id="${ facility }">
                        <div class="details padding">
                        <span>${ name }</span>
                        </div>
                        <i id="priority_list_icon" class="fa fa-sort priority_list_icon"></i>
                        </li>`
                }else{
                    sortableList.innerHTML += `<li class="item medium draggable cons" draggable="true" id="${ facility }">
                        <i id="priority_list_icon" class="fa fa-sort priority_list_icon"></i>
                        <div class="details padding">
                        <span>${ name }</span>
                        </div>
                        </li>`
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

function reset_icons(){
    let icons = document.querySelectorAll("#priority_list_icon");
    icons.forEach(icon => {
        icon.parentElement.classList.remove('dimmed');
        icon.classList.remove('fa-times');
        icon.classList.remove('fa-bolt');
        icon.classList.remove('txt-pine');
        icon.classList.remove('txt-red');
        if (renewables.includes(icon.parentElement.id)){
            icon.classList.add('fa-lock');
        }else{
            icon.classList.add('fa-sort');
        }
    });
}