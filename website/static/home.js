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

fetch("/api/get_generation_prioirity")
    .then((response) => response.json())
    .then((raw_data) => {
        load_const_config().then((const_config) => {
            console.log(raw_data)
            for(facility of raw_data[0]){
                let name = const_config[facility].name;
                sortableList.innerHTML += `<li class="item medium">
                <div class="details padding">
                <span>${ name }</span>
                </div>
                <i class="fa fa-lock padding priority_list_icon"></i>
            </li>`
            }
            for(facility of raw_data[1]){
                let name
                if (storageCharging.includes(facility)){
                    name = const_config[facility.slice(4)].name + " (charge)"
                }else if(storageCharging.includes("buy_" + facility)){
                    name = const_config[facility].name + " (discharge)"
                }else if (facility.includes("buy_")){
                    if (facility.slice(4) in const_config){
                        name = const_config[facility.slice(4)].name
                    }else if(facility == "buy_transport"){
                        name = "Shipments"
                    }else{
                        name = facility.charAt(4).toUpperCase() + facility.slice(5);
                    }
                }else{
                    name = const_config[facility].name
                }
                sortableList.innerHTML += `<li class="item medium draggable" draggable="true" id="${ facility }">
                <div class="details padding">
                <span>${ name }</span>
                </div>
                <i class="fa fa-sort padding priority_list_icon"></i>
            </li>`
            }
            const items = sortableList.querySelectorAll(".item");
            items.forEach(item => {
                item.addEventListener("dragstart", () => item.classList.add("dragging"));
                item.addEventListener("dragend", () => {
                    item.classList.remove("dragging");
                    send_new_list();
                });
                item.addEventListener("touchstart", () => item.classList.add("dragging"));
                item.addEventListener("touchend", () => {
                    item.classList.remove("dragging");
                    send_new_list();
                });
            });
        });
    })
    .catch((error) => {
        console.error(`caught error ${error}`);
    });

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
}

sortableList.addEventListener("dragover", initSortableList);
sortableList.addEventListener("dragenter", e => e.preventDefault());
sortableList.addEventListener("touchmove", initSortableList);
sortableList.addEventListener("touchenter", e => e.preventDefault());

function send_new_list(){
    new_priority = [];
    sortableList.childNodes.forEach(item => {
        if (item.draggable){
            new_priority.push(item.id);
        }
    });
    send_form("/api/request_change_facility_priority", {
        priority: new_priority,
    }).catch((error) => {
            console.error(`caught error ${error}`);
        });
}