const sortableList = document.querySelector(".priority_list");


fetch("/get_generation_prioirity")
    .then((response) => response.json())
    .then((raw_data) => {
        load_const_config().then((const_config) => {
            for(facility of raw_data[1]){
                let name
                if (facility.includes("buy_")){
                    name = const_config[facility.slice(4)].name + " (charge)"
                }else if(raw_data[1].includes("buy_" + facility)){
                    name = const_config[facility].name + " (discharge)"
                }else{
                    name = const_config[facility].name
                }
                sortableList.innerHTML += `<li class="item medium padding" draggable="true" id="${ facility }">
                <div class="details">
                <span>${ name }</span>
                </div>
                <i class="fa fa-arrows-v"></i>
            </li>`
            }
            const items = sortableList.querySelectorAll(".item");
            console.log(items);
            items.forEach(item => {
                item.addEventListener("dragstart", () => item.classList.add("dragging"));
                item.addEventListener("dragend", () => {
                    item.classList.remove("dragging");
                    send_new_list();
                });
            });
            console.log(raw_data);
        });
    })
    .catch((error) => {
        console.error(`caught error ${error}`);
    });

const initSortableList = (e) => {
    e.preventDefault();
    const draggingItem = document.querySelector(".dragging");
    // Getting all items except currently dragging and making array of them
    let siblings = [...sortableList.querySelectorAll(".item:not(.dragging)")];

    // Finding the sibling after which the dragging item should be placed
    let nextSibling = siblings.find(sibling => {
        return e.clientY <= sibling.offsetTop + sibling.offsetHeight / 2;
    });

    // Inserting the dragging item before the found sibling
    sortableList.insertBefore(draggingItem, nextSibling);
}

sortableList.addEventListener("dragover", initSortableList);
sortableList.addEventListener("dragenter", e => e.preventDefault());

function send_new_list(){
    new_priority = [];
    sortableList.childNodes.forEach(item => {
        new_priority.push(item.id);
    });
    send_form("/request_change_facility_priority", {
        priority: new_priority,
    }).catch((error) => {
            console.error(`caught error ${error}`);
        });
}