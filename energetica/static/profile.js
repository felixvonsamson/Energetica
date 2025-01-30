/** @type {typeof import('./table.js')} */
/** @type {typeof import('./display_functions.js')} */

/**
 * 
 * @param {HTMLTableCellElement} cell_element 
 * @param {Object.<string|number, Object>} table_data
 * @param {Object} facility 
 * @param {number | string} id 
 * @param {number} upgrade_cost 
 * @param {boolean} is_summary_row
 * @returns 
 */
function add_upgrade_button(cell_element, table_data, facility, id, upgrade_cost, is_summary_row) {
    if (upgrade_cost == null) {
        cell_element.innerHTML = "-";
        return;
    }
    if (is_summary_row) {
        const button_all = document.createElement("button");
        button_all.classList.add("upgrade_button");
        button_all.innerHTML = format_money(upgrade_cost);
        button_all.onclick = () => are_you_sure_upgrade_all_of_type(id, facility.display_name, upgrade_cost);
        cell_element.appendChild(button_all);
    } else {
        const button_single = document.createElement("button");
        button_single.classList.add("upgrade_button");
        button_single.innerHTML = format_money(upgrade_cost);
        button_single.onclick = () => upgrade(id);
        cell_element.appendChild(button_single);
    }
}

/**
 * @param {HTMLTableCellElement} cell_element
 * @param {Object.<string|number, Object>} table_data
 * @param {Object} facility
 * @param {number | string} id
 * @param {number} dismantle_cost
 * @param {boolean} is_summary_row
 */
function add_dismantle_button(cell_element, table_data, facility, id, dismantle_cost, is_summary_row) {
    if (is_summary_row) {
        const button_all = document.createElement("button");
        button_all.classList.add("dismantle_button");
        button_all.innerHTML = format_money(dismantle_cost);
        button_all.onclick = () => are_you_sure_dismantle_all_of_type(id, facility.display_name, dismantle_cost);
        cell_element.appendChild(button_all);
    } else {
        if (dismantle_cost == null) {
            cell_element.innerHTML = "Decommissioning...";
            return;
        }
        const button_single = document.createElement("button");
        button_single.classList.add("dismantle_button");
        button_single.innerHTML = format_money(dismantle_cost);
        button_single.onclick = () => are_you_sure_dismantle_facility(id, dismantle_cost);
        cell_element.appendChild(button_single);
    }
}

/** @type {DataColumnConfig[]} */
const power_facilities_columns_config = [
    {
        key: "display_name",
        display_name: "Name",
        data_type: 'string',
        default_sort_order: "ascending",
        hide_detail: true, // Hide the name for detail rows.
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
    },
    {
        key: "hourly_op_cost",
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
        hide_detail: true, // Hide the name for detail rows.
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
    },
    {
        key: "hourly_op_cost",
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
        hide_detail: true, // Hide the name for detail rows.
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
    },
    {
        key: "hourly_op_cost",
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
    { key: "installed_cap", order: "descending" },
    true,
);
const storage_facilities_table_manager = new Table(
    storage_facilities_table, storage_facilities_columns_config,
    { key: "storage_capacity", order: "descending" },
    true,
);
const extraction_facilities_table_manager = new Table(
    extraction_facilities_table, extraction_facilities_columns_config,
    { key: "extraction_rate", order: "descending" },
    true,
);

if (window.location.href.includes("player_id")) {
    let profile_header = document.getElementById("profile_header");
    let facilities_list = document.getElementById("facilities_list");
    profile_header.classList.add("hidden");
    facilities_list.style.display = "none";
} else {
    get_active_facilities();
}

async function get_active_facilities() {
    let active_facilities_data;
    try {
        active_facilities_data = await fetch("/api/get_active_facilities").then((response) => response.json());
    } catch (error) {
        console.error("Error:", error);
        throw new Error("Error fetching active facilities data");
    }
    power_facilities_table_manager.update_table_body_with_summary_rows(active_facilities_data.power_facilities);
    storage_facilities_table_manager.update_table_body_with_summary_rows(active_facilities_data.storage_facilities);
    extraction_facilities_table_manager.update_table_body_with_summary_rows(active_facilities_data.extraction_facilities);
}

function are_you_sure_dismantle_facility(facility_id, cost) {
    document.getElementById('are_you_sure_popup').classList.remove('hidden');
    document.getElementById('are_you_sure_content').innerHTML = `Are you sure you want to dismantle this facility?<br>
    This will cost you ${format_money(cost)}.`;
    document.getElementById('yes_im_sure').setAttribute('onclick', `dismantle(${facility_id}); hide_are_you_sure()`);
    document.getElementById('no_cancel').innerHTML = '<b>Cancel</b>';
}

function are_you_sure_dismantle_all_of_type(facility_name, facility_display_name, cost) {
    document.getElementById('are_you_sure_popup').classList.remove('hidden');
    document.getElementById('are_you_sure_content').innerHTML = `Are you sure you want to dismantle all ${facility_display_name}?<br>
    This will cost you ${format_money(cost)}.`;
    document.getElementById('yes_im_sure').setAttribute('onclick', `dismantle_all_of_type('${facility_name}'); hide_are_you_sure()`);
    document.getElementById('no_cancel').innerHTML = '<b>Cancel</b>';
}

function are_you_sure_upgrade_all_of_type(facility_name, facility_display_name, cost) {
    document.getElementById('are_you_sure_popup').classList.remove('hidden');
    document.getElementById('are_you_sure_content').innerHTML = `Are you sure you want to upgrade all ${facility_display_name}?<br>
    This will cost you ${format_money(cost)}.`;
    document.getElementById('yes_im_sure').setAttribute('onclick', `upgrade_all_of_type('${facility_name}'); hide_are_you_sure()`);
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

function upgrade_all_of_type(facility) {
    send_json("/api/request_upgrade_all_of_type", {
        facility: facility,
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

function dismantle_all_of_type(facility) {
    send_json("/api/request_dismantle_all_of_type", {
        facility: facility,
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

// TODO: remove this function
function cost_of_action_all_of_type(table_data, facility_name, key) {
    let cost = 0;
    for (const [id, facility] of Object.entries(table_data)) {
        if (facility.name == facility_name) {
            cost += facility[key];
        }
    }
    return cost;
}