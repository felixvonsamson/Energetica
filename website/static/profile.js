let active_facilities;
let order_by = {
    "power_facilities_table": ["installed_cap", true],
    "storage_facilities_table": ["installed_cap", true],
    "extraction_facilities_table": ["extraction_rate", true],
}

let multiplier_table = {
    "price_multiplier": "price_multiplier",
    "power_multiplier": "multiplier_1",
    "power_consumption_multiplier": "multiplier_1",
    "capacity_multiplier": "multiplier_2",
    "extraction_rate_multiplier": "multiplier_2",
    "hydro_price_multiplier": "multiplier_2",
    "wind_speed_multiplier": "multiplier_2",
    "efficiency_multiplier": "multiplier_3",
    "extraction_emissions_multiplier": "multiplier_3",
}

if (window.location.href.includes("player_id")) {
    let profile_headder = document.getElementById("profile_headder");
    let facilities_list = document.getElementById("facilities_list");
    profile_headder.classList.add("hidden");
    facilities_list.style.display = "none";
} else {
    get_active_facilities(reorder = true);
}

function upgradable(facility, current_multipliers) {
    for (let [key, value] of Object.entries(current_multipliers)) {
        if (facility[multiplier_table[key]] < value) {
            return true;
        }
    }
    return false;
}

function upgrade_cost(facility, current_multipliers, config) {
    if (upgradable(facility, current_multipliers)) {
        const price_diff = current_multipliers.price_multiplier - facility.price_multiplier
        if (price_diff > 0) {
            if (["watermill", "small_water_dam", "large_water_dam"].includes(facility.facility)) {
                return price_diff * config.base_price * facility[multiplier_table.hydro_price_multiplier];
            }
            return price_diff * config.base_price;
        } else {
            return 0.05 * config.base_price;
        }
    } else {
        return null;
    }
}

async function get_active_facilities(reorder = false) {
    try {
        const raw_data = await fetch("/api/get_active_facilities").then((response) => response.json());
        const const_config = await load_const_config();
        const player_data = await load_player_data();
        const wind_power_curve = await load_wind_power_curve();
        const raw_chart_data = await load_chart_data();
        const reserves = await fetch("/api/get_resource_reserves").then((response) => response.json());

        active_facilities = {
            "power_facilities": {},
            "storage_facilities": {},
            "extraction_facilities": {},
        }
        let last_value = JSON.parse(sessionStorage.getItem("last_value"));
        for (const [id, facility] of Object.entries(raw_data.power_facilities)) {
            let config = const_config.assets[facility.facility];
            let tot_cost = config.base_price * facility.price_multiplier;
            if (["watermill", "small_water_dam", "large_water_dam"].includes(facility.facility)) {
                tot_cost *= facility[multiplier_table.hydro_price_multiplier];
            }
            let generating = raw_chart_data.generation[facility.facility][0][359] / player_data.capacities[facility.facility].power
            if (["windmill", "onshore_wind_turbine", "offshore_wind_turbine"].includes(facility.facility)) {
                generating = interpolate_wind_power_curve(wind_power_curve, current_wind_speed * facility[multiplier_table.wind_speed_multiplier]);
            }
            active_facilities.power_facilities[id] = {
                "facility": facility.facility,
                "name": config.name,
                "installed_cap": config.base_power_generation * facility.multiplier_1,
                "used_capacity": generating,
                "op_cost": tot_cost * config["O&M_factor_per_day"] / 24,
                "remaining_lifespan": facility.end_of_life - last_value["total_t"],
                "upgrade": upgrade_cost(facility, player_data.multipliers[facility.facility], config),
                "dismantle": tot_cost * 0.2,
            };
        }
        for (const [id, facility] of Object.entries(raw_data.storage_facilities)) {
            let config = const_config.assets[facility.facility];
            active_facilities.storage_facilities[id] = {
                "facility": facility.facility,
                "name": config.name,
                "installed_cap": config.base_storage_capacity * facility[multiplier_table.capacity_multiplier],
                "used_capacity": raw_chart_data.storage[facility.facility][0][359] / player_data.capacities[facility.facility].capacity,
                "op_cost": config.base_price * facility.price_multiplier * config["O&M_factor_per_day"] / 24,
                "efficiency": config.base_efficiency * facility[multiplier_table.efficiency_multiplier],
                "remaining_lifespan": facility.end_of_life - last_value["total_t"],
                "upgrade": upgrade_cost(facility, player_data.multipliers[facility.facility], config),
                "dismantle": config.base_price * facility.price_multiplier * 0.2,
            };
        }
        let facility_to_resource = {
            "coal_mine": "coal",
            "oil_field": "oil",
            "gas_drilling_site": "gas",
            "uranium_mine": "uranium",
        }
        let cumul_demand = {
            "coal_mine": 0,
            "oil_field": 0,
            "gas_drilling_site": 0,
            "uranium_mine": 0,
        }
        for (const [id, facility] of Object.entries(raw_data.extraction_facilities)) {
            let config = const_config.assets[facility.facility];
            cumul_demand[facility.facility] += config.base_power_consumption * facility.multiplier_1;
        }
        for (const [id, facility] of Object.entries(raw_data.extraction_facilities)) {
            let config = const_config.assets[facility.facility];
            active_facilities.extraction_facilities[id] = {
                "facility": facility.facility,
                "name": config.name,
                "extraction_rate": config.base_extraction_rate_per_day * facility[multiplier_table.extraction_rate_multiplier] * reserves[facility_to_resource[facility.facility]] / 24,
                "used_capacity": raw_chart_data.demand[facility.facility][0][359] / cumul_demand[facility.facility],
                "op_cost": config.base_price * facility.price_multiplier * config["O&M_factor_per_day"] / 24,
                "energy_use": config.base_power_consumption * facility.multiplier_1,
                "remaining_lifespan": facility.end_of_life - last_value["total_t"],
                "upgrade": upgrade_cost(facility, player_data.multipliers[facility.facility], config),
                "dismantle": config.base_price * facility.price_multiplier * 0.2,
            };
        }
        sortTable('power_facilities_table', order_by.power_facilities_table[0], reorder = reorder);
        sortTable('storage_facilities_table', order_by.storage_facilities_table[0], reorder = reorder);
        sortTable('extraction_facilities_table', order_by.extraction_facilities_table[0], reorder = reorder);
    } catch (error) {
        console.error("Error:", error);
    }

    function interpolate_wind_power_curve(wind_power_curve, wind_speed) {
        let curve_index = Math.floor(wind_speed);
        let curve_fraction = wind_speed - curve_index;
        let power = wind_power_curve[curve_index] * (1 - curve_fraction) + wind_power_curve[curve_index + 1] * curve_fraction;
        return power;
    }
}

function sortTable(table_name, columnName, reorder = true) {
    const table = document.getElementById(table_name);
    let column = table.querySelector(`.${columnName}`);
    let triangle = ' <i class="fa fa-caret-down"></i>';

    if (reorder) {
        // Check if the column is already sorted, toggle sorting order accordingly
        if (column.innerHTML.includes(triangle)) {
            order_by[table_name] = [columnName, !order_by[table_name][1]];
            triangle = ' <i class="fa fa-caret-up"></i>';
        } else {
            order_by[table_name] = [columnName, true];
        }
    }

    // Sort the data based on the selected column
    const sortedData = Object.entries(active_facilities[table_name.slice(0, -6)]).sort((a, b) => {
        const aValue = a[1][columnName];
        const bValue = b[1][columnName];

        if (typeof aValue === "string" && typeof bValue === "string") {
            return order_by[table_name][1] ? bValue.localeCompare(aValue) : aValue.localeCompare(bValue);
        } else {
            return order_by[table_name][1] ? bValue - aValue : aValue - bValue;
        }
    });

    // Rebuild the HTML table
    let html;
    if (table_name == "power_facilities_table") {
        html = build_power_facilities_table(sortedData);
    } else if (table_name == "storage_facilities_table") {
        html = build_storage_facilities_table(sortedData);
    } else {
        html = build_extraction_facilities_table(sortedData);
    }
    table.innerHTML = html;

    // Update the sorting indicator
    column = table.querySelector(`.${columnName}`);
    column.innerHTML += triangle;
}

function build_power_facilities_table(sortedData) {
    let html = `<tr>
        <th class="name" onclick="sortTable('power_facilities_table', 'name')">Name</th>
        <th class="installed_cap" onclick="sortTable('power_facilities_table', 'installed_cap')">Max power</th>
        <th class="used_capacity" onclick="sortTable('power_facilities_table', 'used_capacity')">Used Capacity</th>
        <th class="op_cost" onclick="sortTable('power_facilities_table', 'op_cost')">O&M costs</th>
        <th class="remaining_lifespan" onclick="sortTable('power_facilities_table', 'remaining_lifespan')">Lifespan left</th>
        <th class="upgrade" onclick="sortTable('power_facilities_table', 'upgrade')">Upgrade</th>
        <th class="dismantle" onclick="sortTable('power_facilities_table', 'dismantle')">Dismantle</th>
        </tr>`;
    for (const [id, facility] of sortedData) {
        let upgrade = "-";
        if (facility.upgrade != null) {
            upgrade = `<div class="upgrade_container">
                    <button class="upgrade_button" onclick="upgrade(${id})">${format_money(facility.upgrade)}</button>
                    <button class="or_all_button">- or -</button>
                    <button class="upgrade_all_button" onclick="are_you_sure_upgrade_all_of_type(${id}, '${facility.name}')">Upgrade all ${facility.name}</button>
                </div>`;
        }
        html += `<tr>
            <td>${facility.name}</td>
            <td>${format_power(facility.installed_cap)}</td>
            <td>
                <div class="capacityJauge-background">
                    <div class="capacityJauge color_${facility.facility}" style="--width:${facility.used_capacity}"></div>
                    <div class="capacityJauge-txt">${Math.round(facility.used_capacity * 100)}%</div>
                </div>
            </td>
            <td>${format_money(facility.op_cost)}/h</td>
            <td>${format_days(facility.remaining_lifespan)} d</td>
            <td>${upgrade}</td>
            <td>
                <div class="upgrade_container">
                    <button class="dismantle_button" onclick="are_you_sure_dismantle_facility(${id}, ${facility.dismantle})">${format_money(facility.dismantle)}</button>
                    <button class="or_all_button">- or -</button>
                    <button class="dismantle_all_button" onclick="are_you_sure_dismantle_all_of_type(${id}, '${facility.name}')">Dismantle all ${facility.name}</button>
                </div>
            </td>
            </tr>`;
    }
    return html;
}

function build_storage_facilities_table(sortedData) {
    let html = `<tr>
        <th class="name" onclick="sortTable('storage_facilities_table', 'name')">Name</th>
        <th class="installed_cap" onclick="sortTable('storage_facilities_table', 'installed_cap')">Max storage</th>
        <th class="used_capacity" onclick="sortTable('storage_facilities_table', 'used_capacity')">State of Charge</th>
        <th class="op_cost" onclick="sortTable('storage_facilities_table', 'op_cost')">O&M costs</th>
        <th class="efficiency" onclick="sortTable('storage_facilities_table', 'efficiency')">Efficiency</th>
        <th class="remaining_lifespan" onclick="sortTable('storage_facilities_table', 'remaining_lifespan')">Lifespan left</th>
        <th class="upgrade" onclick="sortTable('storage_facilities_table', 'upgrade')">Upgrade</th>
        <th class="dismantle" onclick="sortTable('storage_facilities_table', 'dismantle')">Dismantle</th>
        </tr>`;
    for (const [id, facility] of sortedData) {
        let upgrade = "-";
        if (facility.upgrade != null) {
            upgrade = `<div class="upgrade_container">
                    <button class="upgrade_button" onclick="upgrade(${id})">${format_money(facility.upgrade)}</button>
                    <button class="or_all_button">- or -</button>
                    <button class="upgrade_all_button" onclick="are_you_sure_upgrade_all_of_type(${id}, '${facility.name}')">Upgrade all ${facility.name}</button>
                </div>`;
        }
        html += `<tr>
            <td>${facility.name}</td>
            <td>${format_energy(facility.installed_cap)}</td>
            <td>
                <div class="capacityJauge-background">
                    <div class="capacityJauge color_${facility.facility}" style="--width:${facility.used_capacity}"></div>
                    <div class="capacityJauge-txt">${Math.round(facility.used_capacity * 100)}%</div>
                </div>
            </td>
            <td>${format_money(facility.op_cost)}/h</td>
            <td>${Math.round(facility.efficiency * 100)}%</td>
            <td>${format_days(facility.remaining_lifespan)} d</td>
            <td>${upgrade}</td>
            <td>
                <div class="upgrade_container">
                    <button class="dismantle_button" onclick="are_you_sure_dismantle_facility(${id}, ${facility.dismantle})">${format_money(facility.dismantle)}</button>
                    <button class="or_all_button">- or -</button>
                    <button class="dismantle_all_button" onclick="are_you_sure_dismantle_all_of_type(${id}, '${facility.name}')">Dismantle all ${facility.name}</button>
                </div>
            </td>
            </tr>`;
    }
    return html;
}

function build_extraction_facilities_table(sortedData) {
    let html = `<tr>
        <th class="name" onclick="sortTable('extraction_facilities_table', 'name')">Name</th>
        <th class="extraction_rate" onclick="sortTable('extraction_facilities_table', 'extraction_rate')">Extraction rate</th>
        <th class="used_capacity" onclick="sortTable('extraction_facilities_table', 'used_capacity')">Used Capacity</th>
        <th class="op_cost" onclick="sortTable('extraction_facilities_table', 'op_cost')">O&M costs</th>
        <th class="energy_use" onclick="sortTable('extraction_facilities_table', 'energy_use')">Energy use</th>
        <th class="remaining_lifespan" onclick="sortTable('extraction_facilities_table', 'remaining_lifespan')">Lifespan left</th>
        <th class="upgrade" onclick="sortTable('extraction_facilities_table', 'upgrade')">Upgrade</th>
        <th class="dismantle" onclick="sortTable('extraction_facilities_table', 'dismantle')">Dismantle</th>
        </tr>`;
    for (const [id, facility] of sortedData) {
        let upgrade = "-";
        if (facility.upgrade != null) {
            upgrade = `<div class="upgrade_container">
                    <button class="upgrade_button" onclick="upgrade(${id})">${format_money(facility.upgrade)}</button>
                    <button class="or_all_button">- or -</button>
                    <button class="upgrade_all_button" onclick="are_you_sure_upgrade_all_of_type(${id}, '${facility.name}')">Upgrade all ${facility.name}</button>
                </div>`;
        }
        html += `<tr>
            <td>${facility.name}</td>
            <td>${format_mass_rate(facility.extraction_rate)}</td>
            <td>
                <div class="capacityJauge-background">
                    <div class="capacityJauge color_${facility.facility}" style="--width:${facility.used_capacity}"></div>
                    <div class="capacityJauge-txt">${Math.round(facility.used_capacity * 100)}%</div>
                </div>
            </td>
            <td>${format_money(facility.op_cost)}/h</td>
            <td>${format_power(facility.energy_use)}</td>
            <td>${format_days(facility.remaining_lifespan)} d</td>
            <td>${upgrade}</td>
            <td>
                <div class="upgrade_container">
                    <button class="dismantle_button" onclick="are_you_sure_dismantle_facility(${id}, ${facility.dismantle})">${format_money(facility.dismantle)}</button>
                    <button class="or_all_button">- or -</button>
                    <button class="dismantle_all_button" onclick="are_you_sure_dismantle_all_of_type(${id}, '${facility.name}')">Dismantle all ${facility.name}</button>
                </div>
            </td>
            </tr>`;
    }
    return html;
}

function are_you_sure_dismantle_facility(facility_id, cost) {
    document.getElementById('are_you_sure_popup').classList.remove('hidden');
    document.getElementById('are_you_sure_content').innerHTML = `Are you sure you want to dismantle this facility?<br>
    This will cost you ${format_money(cost)}.`;
    document.getElementById('yes_im_sure').setAttribute('onclick', `dismantle(${facility_id}); hide_are_you_sure()`);
    document.getElementById('no_cancel').innerHTML = '<b>Cancel</b>';
}

function are_you_sure_dismantle_all_of_type(facility_id, facility_name) {
    let cost = cost_of_action_all_of_type(facility_name, "dismantle");
    document.getElementById('are_you_sure_popup').classList.remove('hidden');
    document.getElementById('are_you_sure_content').innerHTML = `Are you sure you want to dismantle all ${facility_name}?<br>
    This will cost you ${format_money(cost)}.`;
    document.getElementById('yes_im_sure').setAttribute('onclick', `dismantle_all_of_type('${facility_id}'); hide_are_you_sure()`);
    document.getElementById('no_cancel').innerHTML = '<b>Cancel</b>';
}

function are_you_sure_upgrade_all_of_type(facility_id, facility_name) {
    let cost = cost_of_action_all_of_type(facility_name, "upgrade");
    document.getElementById('are_you_sure_popup').classList.remove('hidden');
    document.getElementById('are_you_sure_content').innerHTML = `Are you sure you want to upgrade all ${facility_name}?<br>
    This will cost you ${format_money(cost)}.`;
    document.getElementById('yes_im_sure').setAttribute('onclick', `upgrade_all_of_type('${facility_id}'); hide_are_you_sure()`);
    document.getElementById('no_cancel').innerHTML = '<b>Cancel</b>';
}

function upgrade(id) {
    send_form("/api/request_upgrade_facility", {
        facility_id: id,
    }).then((response) => {
        response.json().then((raw_data) => {
            let response = raw_data["response"];
            if (response == "success") {
                let money = raw_data["money"];
                var obj = document.getElementById("money");
                obj.innerHTML = format_money_long(money);
                retrieve_player_data().then(() => {
                    get_active_facilities();
                });
            } else if (response == "notEnoughMoney") {
                addError("Not enough money");
            }
        });
    })
        .catch((error) => {
            console.error(`caught error ${error}`);
        });
}

function upgrade_all_of_type(facility_id) {
    send_form("/api/request_upgrade_all_of_type", {
        facility_id: facility_id,
    }).then((response) => {
        response.json().then((raw_data) => {
            let response = raw_data["response"];
            if (response == "success") {
                let money = raw_data["money"];
                var obj = document.getElementById("money");
                obj.innerHTML = format_money_long(money);
                retrieve_player_data().then(() => {
                    get_active_facilities();
                });
            } else if (response == "notEnoughMoney") {
                addError("Not enough money");
            }
        });
    })
        .catch((error) => {
            console.error(`caught error ${error}`);
        });
}

function dismantle(id) {
    send_form("/api/request_dismantle_facility", {
        facility_id: id,
    }).then((response) => {
        response.json().then((raw_data) => {
            let response = raw_data["response"];
            if (response == "success") {
                let money = raw_data["money"];
                var obj = document.getElementById("money");
                obj.innerHTML = format_money_long(money);
                get_active_facilities();
            } else if (response == "notEnoughMoney") {
                addError("Not enough money");
            } else if (response == "notUpgradable") {
                addError("Facility is not upgradable");
            }
        });
    })
        .catch((error) => {
            console.error(`caught error ${error}`);
        });
}

function dismantle_all_of_type(facility_id) {
    send_form("/api/request_dismantle_all_of_type", {
        facility_id: facility_id,
    }).then((response) => {
        response.json().then((raw_data) => {
            let response = raw_data["response"];
            if (response == "success") {
                let money = raw_data["money"];
                var obj = document.getElementById("money");
                obj.innerHTML = format_money_long(money);
                get_active_facilities();
            } else if (response == "notEnoughMoney") {
                addError("Not enough money");
            }
        });
    })
        .catch((error) => {
            console.error(`caught error ${error}`);
        });
}

function cost_of_action_all_of_type(facility_name, action) {
    let cost = 0;
    for (const family in active_facilities) {
        for (const [id, facility] of Object.entries(active_facilities[family])) {
            if (facility.name == facility_name) {
                cost += facility[action];
            }
        }
    }
    return cost;
}