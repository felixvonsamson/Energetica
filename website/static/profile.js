let active_facilities;
let decending = true;

if (window.location.href.includes("player_id")){
  let profile_headder = document.getElementById("profile_headder");
  profile_headder.classList.add("hidden");
}
get_active_facilities();

function upgradable(facility, current_multipliers){
    multiplier_table = {
        "price_multiplier": "price_multiplier",
        "power_multiplier": "power_multiplier",
        "efficiency_multiplier": "efficiency_multiplier",
        "capacity_multiplier": "capacity_multiplier",
        "extraction_multiplier": "capacity_multiplier",
        "power_use_multiplier": "power_multiplier",
        "pollution_multiplier": "efficiency_multiplier",
    }
    for (let [key, value] of Object.entries(current_multipliers)){
        if (facility[multiplier_table[key]] < value){
            return true;
        }
    }
    return false;
}

function upgrade_cost(facility, current_multipliers, config){
    if (upgradable(facility, current_multipliers)){
        const price_diff = current_multipliers.price_multiplier - facility.price_multiplier
        if (price_diff > 0){
            return price_diff * config.base_price;
        }else{
            return 0.05 * config.base_price;
        }
    }else{
        return null;
    }
}

function get_active_facilities() {
    fetch("/api/get_active_facilities") // retrieves all active facilities of the player
        .then((response) => response.json())
        .then((raw_data) => {
            load_const_config().then((const_config) => {
                load_player_data().then((player_data) => {
                    decending = false;
                    active_facilities = {
                        "power_facilities": {},
                        "storage_facilities": {},
                        "extraction_facilities": {},
                    }
                    for (const [id, facility] of Object.entries(raw_data.power_facilities)) {
                        let config = const_config.assets[facility.facility];
                        let last_value = JSON.parse(sessionStorage.getItem("last_value"));
                        active_facilities.power_facilities[id] = {
                            "name": config.name,
                            "installed_cap": config.base_power_generation * facility.power_multiplier,
                            "op_cost": config.base_price * facility.price_multiplier * config["O&M_factor"] * 3600 / clock_time,
                            "remaining_lifespan": (facility.end_of_life - last_value["total_t"]) * clock_time,
                            "upgrade": upgrade_cost(facility, player_data.multipliers[facility.facility], config),
                            "dismantle": config.base_price * facility.price_multiplier * 0.2,
                        };
                    }
                    sortTable('installed_cap');
                });
            });
        })
        .catch((error) => {
            console.error("Error:", error);
        });
}

function sortTable(columnName) {
    const table = document.getElementById("power_facilities_table");
    let column = document.getElementById(columnName);
    let triangle = ' <i class="fa fa-caret-down"></i>';

    // Check if the column is already sorted, toggle sorting order accordingly
    if (column.innerHTML.includes(triangle)) {
        decending = !decending;
        triangle = ' <i class="fa fa-caret-up"></i>';
    }else{
        decending = true;
    }

    // Sort the data based on the selected column
    const sortedData = Object.entries(active_facilities.power_facilities).sort((a, b) => {
        const aValue = a[1][columnName];
        const bValue = b[1][columnName];

        if (typeof aValue === "string" && typeof bValue === "string") {
            return decending ? bValue.localeCompare(aValue) : aValue.localeCompare(bValue);
        } else {
            return decending ? bValue - aValue : aValue - bValue;
        }
    });

    // Rebuild the HTML table
    let html = `<tr>
        <th id="name" onclick="sortTable('name')">Name</th>
        <th id="installed_cap" onclick="sortTable('installed_cap')">Max power</th>
        <th id="op_cost" onclick="sortTable('op_cost')">O&M costs</th>
        <th id="remaining_lifespan" onclick="sortTable('remaining_lifespan')">Lifespan left</th>
        <th id="upgrade" onclick="sortTable('upgrade')">Upgrade</th>
        <th id="dismantle" onclick="sortTable('dismantle')">Dismantle</th>
        </tr>`;
    for (const [id, facility] of sortedData) {
        let upgrade = "-";
        if(facility.upgrade != null){
            upgrade = `<button class="upgrade_button" onclick="upgrade(${id})">${display_money(facility.upgrade, write=false)}</button>`;
        }
        html += `<tr>
            <td>${facility.name}</td>
            <td>${display_W(facility.installed_cap, write=false)}</td>
            <td>${display_money(facility.op_cost, write=false)}/h</td>
            <td>${display_days(facility.remaining_lifespan, write=false)} d</td>
            <td>${upgrade}</td>
            <td><button class="dismantle_button" onclick="dismantle(${id})">${display_money(facility.dismantle, write=false)}</button></td>
            </tr>`;
    }
    table.innerHTML = html;
    
    // Update the sorting indicator
    column = document.getElementById(columnName);
    column.innerHTML += triangle;
}

function upgrade(id){
    send_form("/api/request_upgrade_facility", {
        facility_id: id,
    }).then((response) => {
        response.json().then((raw_data) => {
            let response = raw_data["response"];
            if (response == "success") {
                get_active_facilities();
            }else if(response == "notEnoughMoney"){
                addError("Not enough money");
            }
        });
    })
    .catch((error) => {
        console.error(`caught error ${error}`);
    });
}

function dismantle(id){
    send_form("/api/request_dismantle_facility", {
        facility_id: id,
    }).then((response) => {
        response.json().then((raw_data) => {
            let response = raw_data["response"];
            if (response == "success") {
                get_active_facilities();
            }else if(response == "notEnoughMoney"){
                addError("Not enough money");
            }else if(response == "notUpgradable"){
                addError("Facility is not upgradable");
            }
        });
    })
    .catch((error) => {
        console.error(`caught error ${error}`);
    });
}

