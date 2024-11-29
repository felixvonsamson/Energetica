/** @type {typeof import('./table.js')} */
/** @type {typeof import('./display_functions.js')} */

/**
 * 
 * @param {HTMLTableCellElement} cell_element 
 * @param {Object} facility 
 * @param {number | string} id 
 * @param {number} upgrade_cost 
 * @returns 
 */
function add_upgrade_button(cell_element, facility, id, upgrade_cost) {
    if (upgrade_cost == null) {
        cell_element.innerHTML = "-";
        return;
    }
    const container = document.createElement("div");
    container.classList.add("upgrade_container");
    const button_single = document.createElement("button");
    button_single.classList.add("upgrade_button");
    button_single.innerHTML = format_money(upgrade_cost);
    button_single.onclick = () => upgrade(id);
    const button_or = document.createElement("button");
    button_or.classList.add("or_all_button");
    button_or.innerHTML = "- or -";
    const button_all = document.createElement("button");
    button_all.classList.add("upgrade_all_button");
    button_all.innerHTML = `Upgrade all ${facility.display_name}`;
    button_all.onclick = () => are_you_sure_upgrade_all_of_type(id, facility.display_name);
    container.appendChild(button_single);
    container.appendChild(button_or);
    container.appendChild(button_all);
    cell_element.appendChild(container);
}

/**
 * @param {HTMLTableCellElement} cell_element
 * @param {Object} facility
 * @param {number | string} id
 * @param {number} dismantle_cost
 */
function add_dismantle_button(cell_element, facility, id, dismantle_cost) {
    const container = document.createElement("div");
    container.classList.add("upgrade_container");
    const button_single = document.createElement("button");
    button_single.classList.add("dismantle_button");
    button_single.innerHTML = format_money(dismantle_cost);
    button_single.onclick = () => are_you_sure_dismantle_facility(id, dismantle_cost);
    const button_or = document.createElement("button");
    button_or.classList.add("or_all_button");
    button_or.innerHTML = "- or -";
    const button_all = document.createElement("button");
    button_all.classList.add("dismantle_all_button");
    button_all.innerHTML = `Dismantle all ${facility.display_name}`;
    button_all.onclick = () => are_you_sure_dismantle_all_of_type(id, facility.display_name);
    container.appendChild(button_single);
    container.appendChild(button_or);
    container.appendChild(button_all);
    cell_element.appendChild(container);
}

/** @type {DataColumnConfig[]} */
const power_facilities_columns_config = [
    {
        key: "display_name",
        display_name: "Name",
        data_type: 'string',
        default_sort_order: "ascending",
    },
    {
        key: "installed_cap",
        display_name: "Max power",
        data_type: "number",
        render_cell: (_, __, value) => format_power(value),
    },
    {
        key: "usage",
        display_name: "Power output",
        data_type: "number",
        special_render: "gauge",
        gauge_class: (data, _, __) => `color_${data.facility}`,
    },
    {
        key: "op_cost",
        display_name: "O&M cost",
        data_type: "number",
        render_cell: (_, __, value) => format_money(value) + "/h",
    },
    {
        key: "remaining_lifespan",
        display_name: "Lifespan left",
        data_type: "number",
        default_sort_order: "ascending", // Players might want to see the facilities with the least lifespan left first.
        render_cell: (_, __, value) => format_days(value) + " d",
    },
    {
        key: "upgrade_cost",
        display_name: "Upgrade",
        data_type: "number",
        default_sort_order: "ascending",
        populate_cell_content: add_upgrade_button
    },
    {
        key: "dismantle_cost",
        display_name: "Dismantle",
        data_type: "number",
        default_sort_order: "ascending",
        populate_cell_content: add_dismantle_button,
    },
];

/** @type {DataColumnConfig[]} */
const storage_facilities_columns_config = [
    {
        key: "display_name",
        display_name: "Name",
        data_type: 'string',
        default_sort_order: "ascending",
    },
    {
        key: "storage_capacity",
        display_name: "Max storage",
        data_type: "number",
        render_cell: (_, __, value) => format_energy(value),
    },
    {
        key: "state_of_charge",
        display_name: "State of Charge",
        data_type: "number",
        special_render: "gauge",
        gauge_class: (data, _, __) => `color_${data.facility}`,
    },
    {
        key: "op_cost",
        display_name: "O&M cost",
        data_type: "number",
        render_cell: (_, __, value) => format_money(value) + "/h",
    },
    {
        key: "efficiency",
        display_name: "Efficiency",
        data_type: "number",
        render_cell: (_, __, value) => Math.round(value * 100) + "%",
    },
    {
        key: "remaining_lifespan",
        display_name: "Lifespan left",
        data_type: "number",
        default_sort_order: "ascending", // Players might want to see the facilities with the least lifespan left first.
        render_cell: (_, __, value) => format_days(value) + " d",
    },
    {
        key: "upgrade_cost",
        display_name: "Upgrade",
        data_type: "number",
        default_sort_order: "ascending",
        populate_cell_content: add_upgrade_button
    },
    {
        key: "dismantle_cost",
        display_name: "Dismantle",
        data_type: "number",
        default_sort_order: "ascending",
        populate_cell_content: add_dismantle_button,
    }
];

/** @type {DataColumnConfig[]} */
const extraction_facilities_columns_config = [
    {
        key: "display_name",
        display_name: "Name",
        data_type: 'string',
        default_sort_order: "ascending",
    },
    {
        key: "extraction_rate",
        display_name: "Extraction rate",
        data_type: "number",
        render_cell: (_, __, value) => format_mass_rate(value),
    },
    {
        key: "usage",
        display_name: "Usage",
        data_type: "number",
        special_render: "gauge",
        gauge_class: (data, _, __) => `color_${data.facility}`,
    },
    {
        key: "op_cost",
        display_name: "O&M cost",
        data_type: "number",
        render_cell: (_, __, value) => format_money(value) + "/h",
    },
    {
        key: "max_power_use",
        display_name: "Power use",
        data_type: "number",
        render_cell: (_, __, value) => format_power(value),
    },
    {
        key: "remaining_lifespan",
        display_name: "Lifespan left",
        data_type: "number",
        default_sort_order: "ascending", // Players might want to see the facilities with the least lifespan left first.
        render_cell: (_, __, value) => format_days(value) + " d",
    },
    {
        key: "upgrade_cost",
        display_name: "Upgrade",
        data_type: "number",
        default_sort_order: "ascending",
        populate_cell_content: add_upgrade_button,
    },
    {
        key: "dismantle_cost",
        display_name: "Dismantle",
        data_type: "number",
        default_sort_order: "ascending",
        populate_cell_content: add_dismantle_button,
    }
];

const power_facilities_table = document.getElementById("power_facilities_table");
const storage_facilities_table = document.getElementById("storage_facilities_table");
const extraction_facilities_table = document.getElementById("extraction_facilities_table");
if (!(power_facilities_table instanceof HTMLTableElement)) {
    throw new Error("Element 'power_facilities_table' is not a table");
}
if (!(storage_facilities_table instanceof HTMLTableElement)) {
    throw new Error("Element 'storage_facilities_table' is not a table");
}
if (!(extraction_facilities_table instanceof HTMLTableElement)) {
    throw new Error("Element 'extraction_facilities_table' is not a table");
}
const power_facilities_table_manager = new Table(
    power_facilities_table, power_facilities_columns_config,
    { key: "installed_cap", order: "descending" }
);
const storage_facilities_table_manager = new Table(
    storage_facilities_table, storage_facilities_columns_config,
    { key: "storage_capacity", order: "descending" }
);
const extraction_facilities_table_manager = new Table(
    extraction_facilities_table, extraction_facilities_columns_config,
    { key: "extraction_rate", order: "descending" }
);

let active_facilities;
let order_by = {
    "extraction_facilities_table": ["extraction_rate", true],
};

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
};

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
        const price_diff = current_multipliers.price_multiplier - facility.price_multiplier;
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
        const raw_data = await fetch("/api/get_active_facilities_OLD").then((response) => response.json());
        const const_config = await load_const_config();
        const player_data = await load_player_data();
        const reserves = await fetch("/api/get_resource_reserves").then((response) => response.json());

        active_facilities = {
            "extraction_facilities": {},
        };
        let last_value = JSON.parse(sessionStorage.getItem("last_value"));
        let facility_to_resource = {
            "coal_mine": "coal",
            "gas_drilling_site": "gas",
            "uranium_mine": "uranium",
        };
        let cumul_demand = {
            "coal_mine": 0,
            "gas_drilling_site": 0,
            "uranium_mine": 0,
        };
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
                "used_capacity": facility.usage,
                "op_cost": config.base_price * facility.price_multiplier * config["O&M_factor_per_day"] / 24,
                "energy_use": config.base_power_consumption * facility.multiplier_1,
                "remaining_lifespan": facility.end_of_life - last_value["total_t"],
                // The following lines should be removed / reworked as it relies on get_current_technology_values
                "upgrade": upgrade_cost(facility, player_data.multipliers[facility.facility], config),
                "dismantle": config.base_price * facility.price_multiplier * 0.2,
            };
        }
    } catch (error) {
        console.error("Error:", error);
    }
    try {
        const active_facilities_data = await fetch("/api/get_active_facilities").then((response) => response.json());
        power_facilities_table_manager.update_table_body(active_facilities_data.power_facilities);
        storage_facilities_table_manager.update_table_body(active_facilities_data.storage_facilities);
        extraction_facilities_table_manager.update_table_body(active_facilities_data.extraction_facilities);
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
    send_json("/api/request_upgrade_facility", {
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
    send_json("/api/request_upgrade_all_of_type", {
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
    send_json("/api/request_dismantle_facility", {
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
    send_json("/api/request_dismantle_all_of_type", {
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