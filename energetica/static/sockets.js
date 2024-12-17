/* 
This code contains the main functions that communicate with the server (client side)
*/

/**
 * @type {typeof import('./frontend_data.js').load_chats}
 * @type {typeof import('./display_functions.js')}
 */

socket.on("infoMessage", addToast);

socket.on("errorMessage", addError);

function send_json(endpoint, body) {
    return fetch(endpoint, {
        method: "POST",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });
}

//debug info for connection error
socket.on("connect_error", (err) => {
    // the reason of the error, for example "xhr poll error"
    console.log(err.message);

    // some additional description, for example the status code of the initial HTTP response
    console.log(err.description);

    // some additional context, for example the XMLHttpRequest object
    console.log(err.context);
});

//function that checks if the connection is a new connection or not
function check_new_connection() {
    const last_value = JSON.parse(sessionStorage.getItem("last_value"));
}

socket.on("get_players", function (players) {
    sessionStorage.setItem("players", JSON.stringify(players));
});

socket.on("retrieve_player_data", function () {
    retrieve_player_data();
    retrieve_chart_data();
});

// receive new values from the server
socket.on("new_values", function (changes) {

    function integrate_new_values(old_values, new_values) {
        for (var category in new_values) {
            for (var subcategory in new_values[category]) {
                if (!old_values[category].hasOwnProperty(subcategory)) {
                    old_values[category][subcategory] = Array.from(
                        { length: 5 },
                        () => Array(360).fill(0)
                    );
                }
                var value = new_values[category][subcategory];
                var array = old_values[category][subcategory];
                reduce_resolution(value, array, total_t);
            }
        }
    }

    let money = document.getElementById("money");
    if (money != null) {
        money.innerHTML = format_money_long(changes["money"]);
    }
    let total_t = changes["total_t"];
    let last_value = JSON.parse(sessionStorage.getItem("last_value"));
    if (!last_value || total_t == 1) {
        retrieve_all();
    } else if (last_value["total_t"] + 1 != total_t) {
        retrieve_all();
    } else {
        const currentDate = new Date();
        sessionStorage.setItem(
            "last_value",
            JSON.stringify({ total_t: total_t, time: currentDate })
        );
        let climate_data = JSON.parse(sessionStorage.getItem("climate_data"));
        integrate_new_values(climate_data, changes.climate_values);
        sessionStorage.setItem("climate_data", JSON.stringify(climate_data));

        let chart_data = JSON.parse(sessionStorage.getItem("chart_data"));
        integrate_new_values(chart_data, changes.chart_values);
        sessionStorage.setItem("chart_data", JSON.stringify(chart_data));

        sessionStorage.setItem("cumulative_emissions", JSON.stringify(changes.cumulative_emissions));

        construction_updates = changes.construction_updates;
        if (Object.keys(construction_updates).length > 0) {
            constructions_data = JSON.parse(sessionStorage.getItem("constructions"));
            for (var construction_id in construction_updates) {
                let construction = constructions_data[0][construction_id];
                construction.speed = construction_updates[construction_id].speed;
                construction.end_tick_or_ticks_passed = construction_updates[construction_id].end_tick;
            }
            sessionStorage.setItem("constructions", JSON.stringify(constructions_data));
            if (typeof display_progressBars === "function") {
                display_progressBars(constructions_data, null);
            }
        }

        shipment_updates = changes.shipment_updates;
        if (Object.keys(shipment_updates).length > 0) {
            shipments_data = JSON.parse(sessionStorage.getItem("shipments"));
            for (var shipment_id in shipment_updates) {
                let shipment = shipments_data[0][shipment_id];
                shipment.speed = shipment_updates[shipment_id].speed;
                shipment.arrival_tick = shipment_updates[shipment_id].arrival_tick;
            }
            sessionStorage.setItem("shipments", JSON.stringify(shipments_data));
            if (typeof display_progressBars === "function") {
                display_progressBars(null, shipments_data);
            }

            if (typeof fetch_graph_data === "function") {
                fetch_graph_data();
            }
            if (typeof fetch_temporal_network_data === "function") {
                fetch_temporal_network_data();
            }
            if (typeof update_weather_conditions === "function") {
                update_weather_conditions();
            }
        }
        if (window.location.href.includes("/profile") && !window.location.href.includes("player_id")) {
            get_active_facilities();
        }
    }
});

// get information about finished construction
socket.on("finish_construction", function (construction_data) {
    sessionStorage.setItem("constructions", JSON.stringify(construction_data));
    refresh_progressBar();
});

// get information about finished shipments
socket.on("finish_shipment", function (shipment_data) {
    sessionStorage.setItem("shipments", JSON.stringify(shipment_data));
    refresh_progressBar();
});


// receive new network values from the server
socket.on("new_network_values", function (changes) {
    let total_t = changes["total_t"];
    let last_value = JSON.parse(sessionStorage.getItem("last_value_network"));
    if (!last_value) {
        retrieve_all();
    } else if (last_value["total_t"] + 1 != total_t) {
        retrieve_all();
    } else {
        const currentDate = new Date();
        sessionStorage.setItem(
            "last_value_network",
            JSON.stringify({ total_t: total_t, time: currentDate })
        );
        let network_data = JSON.parse(sessionStorage.getItem("network_data"));
        for (var category in changes["network_values"]) {
            for (var group in changes["network_values"][category]) {
                if (!network_data[category].hasOwnProperty(group)) {
                    network_data[category][group] = Array.from(
                        { length: 5 },
                        () => Array(360).fill(0)
                    );
                }
                var value = changes["network_values"][category][group];
                let array = network_data[category][group];
                reduce_resolution(value, array, total_t);
            }
            for (var group in network_data[category]) {
                if (!changes["network_values"][category].hasOwnProperty(group)) {
                    let array = network_data[category][group];
                    reduce_resolution(0, array, total_t);
                }
            }
        }
        sessionStorage.setItem("network_data", JSON.stringify(network_data));
    }
});

function reduce_resolution(value, array, total_t) {
    array[0].shift();
    array[0].push(value);
    for (r = 1; r < 5; r++) {
        factor = Math.pow(6, r);
        let mod = total_t % factor;
        if (mod != 0) {
            if (r == 4) {
                let mod_6 = Math.ceil(mod / 6);
                array[r][359] = array[1].slice(-mod_6).reduce((acc, val) => acc + val, 0) / mod_6;
            } else {
                array[r][359] = array[0].slice(-mod).reduce((acc, val) => acc + val, 0) / mod;
            }
        } else {
            array[r].shift();
            let new_val = ((factor - 1) * array[r][358] + array[0][359]) / factor;
            array[r].push(new_val);
        }
    }
}

// updates specific fields of the page without reloading
socket.on("new_notification", function (notification) {
    let notification_list = document.getElementById("notification_list-small");
    if (notification_list != null) {
        notification_list.innerHTML +=
            `<div id="notification_${notification["id"]}" class="notification padding-small margin-small">
            <b>${notification["title"]}</b><br>
            ${notification["content"]}
            </div>`;
        scroll_down_small_notification_list();
    }
    notification_list = document.getElementById("notification_list");
    if (notification_list != null) {
        notification_list.innerHTML +=
            `<div id="notification_${notification["id"]}" class="notification padding medium margin-large">
            <div class="small notification_time">${formatDateTime(notification["time"])}</div>
            <div class="flex-row align-items-center notification_head">
            <b>${notification["title"]}<i class="fa fa-circle small padding"></i></b>
            <span onclick="delete_notification(this, ${notification["id"]});" class="cross">×</span></div>
            ${notification["content"]}
            </div>`;
    }
    let notification_button = document.getElementById("notification_button");
    if (notification_button != null) {
        let unread_badge = document.getElementById("unread_badge");
        if (unread_badge != null) {
            unread_badge.innerHTML = parseInt(unread_badge.innerHTML) + 1;
        } else {
            notification_button.innerHTML +=
                '<span id="unread_badge" class="unread_badge small pine padding-small">1</span>';
        }
    }
});

socket.on("display_new_message", function (message) {
    let obj = document.getElementById("message_container");
    load_chats().then((chat_data) => {
        if (obj != null) {
            if (current_chat_id == message.chat_id) {
                load_players().then((players) => {
                    let alignment = "left";
                    let username = "";
                    if (message.player_id == sessionStorage.getItem("player_id")) {
                        alignment = "right";
                    } else if (chat_data.chat_list[message.chat_id].group_chat) {
                        username = players[message.player_id].username + "&emsp;";
                    }
                    obj.innerHTML += `<div class="message ${alignment}">
                        <div class="message_infos">
                            <span>${username}</span>
                            <span class="txt_pine">${formatDateString(message.time)}</span></div>
                        <div class="message_text bone ${alignment}">${message.text}</div>
                    </div>`;
                    obj.scrollTop = obj.scrollHeight;
                });
            }
        }
        if (!chat_data.chat_list[message.chat_id]) {
            retrieve_chats();
        } else {
            if (chat_data.chat_list[message.chat_id].unread_messages == 0) {
                chat_data.unread_chats += 1;
            }
            chat_data.chat_list[message.chat_id].unread_messages += 1;
            sessionStorage.setItem("chats", JSON.stringify(chat_data));
            if (typeof refresh_chats === 'function') {
                refresh_chats();
            }
        }
    });
});

// reloads the page
socket.on("refresh", function () {
    window.location = window.location;
});

/** 
 * This function parses data sent from the server relating to various pages (power, storage, extraction, and functional
 * facilities, technologies) and updates the HTML accordingly.
 */
socket.on("update_page_data", function (pages_data) {
    // The `path` variable is used to determine what page is currently open. Possible values are:
    // "power_facilities", "storage_facilities", "extraction_facilities", "functional_facilities" and "technology"
    let path = document.baseURI.split('/').pop();

    /**
     * Updates the construction information and the requirements of a particular facility's / technology's corresponding
     * div element
     * 
     * @param {Object} data The new data for this facility / technology
     * @param {HTMLElement} div The HTML element corresponding to the this facility / technology
     * @param {boolean} on_technologies_page Should be true for technologies and false for all others
     */
    function update_base_data(data, div, on_technologies_page) {
        // This data needs updating for all facilities and all technologies
        div.querySelector("#price").innerHTML = format_money_long(data.price);
        div.querySelectorAll(".construction_power").forEach(el => {
            el.innerHTML = format_power(data.construction_power);
        });
        div.querySelectorAll(".construction_time").forEach(el => {
            el.innerHTML = format_duration(data.construction_time);
        });
        div.querySelector("#requirements").style.cssText =
            data.requirements_status == "satisfied" ? "display:none" : "";
        if (data.requirements_status != "satisfied") {
            function requirement_to_list_item(req) {
                let req_display_name = req.name == "mechanical_engineering" ? "Mech. engineering" : req.display_name;
                return `<li class=\"padding-small requirement-${req.status}\">
                        - ${req_display_name} lvl ${req.level}
                        </li>`;
            }
            div.querySelector("#requirements_list").innerHTML =
                data.requirements.map(requirement_to_list_item).join('');
        }
        construction_button = div.querySelector("#construction_button");
        construction_button_mobile = div.querySelector("#construction_button_mobile");
        if (data.requirements_status == "unsatisfied") {
            construction_button.className = "padding medium margin txt_center white txt-red";
            construction_button_mobile.className = "padding medium margin txt_center white txt-red";
            construction_button.innerHTML = "Locked";
            construction_button_mobile.innerHTML = "Locked";
        } else {
            construction_button.className = "padding medium button margin txt_center white";
            construction_button_mobile.className = "padding medium button margin txt_center white";
            if (!on_technologies_page) {
                construction_button.innerHTML = "Start construction";
                construction_button_mobile.innerHTML = "Start construction";
            } else {
                if (data.requirements_status == "satisfied") {
                    construction_button.innerHTML = "Start research";
                    construction_button_mobile.innerHTML = "Start research";
                } else {
                    construction_button.innerHTML = "Queue research";
                    construction_button_mobile.innerHTML = "Queue research";
                }
            }
        }
    }

    /**
     * Updates the construction pollution of a particular facility's div element
     * 
     * @param {Object} data The new data for this facility
     * @param {number} data.construction_pollution The cost in CO2 emissions for constructing this facility, in kg
     * @param {HTMLElement} div The HTML element corresponding to the this facility
     */
    function update_polluting_projects(data, div) {
        // This data is shared for all facilities, so only technologies are absent
        div.querySelectorAll(".construction_pollution").forEach(el => {
            el.innerHTML = format_mass(data.construction_pollution) + " CO<sub>2</sub>";
        });
    }
    /**
     * Updates the operating cost and lifespan of a particular facility's div element
     * 
     * @param {Object} data The new data for this facility
     * @param {number} data.operating_costs The operating costs for this facility, in units per hour
     * @param {number} data.lifespan The lifespan for this facility, in days
     * @param {HTMLElement} div The HTML element corresponding to the this facility
     */
    function update_buildings_data(data, div) {
        // This data is shared for all power, storage, and extraction facilities
        div.querySelector("#operating_costs").innerHTML = format_money(data.operating_costs) + "/h";
        div.querySelector("#lifespan").innerHTML = format_days(data.lifespan) + " days";
    }
    /**
     * Updates the power generation and ramping speed of a particular facility's div element
     * 
     * @param {Object} data The new data for this facility
     * @param {number} data.power_generation The maximum power output for this facility, in units per watts
     * @param {number} data.ramping_speed The ramping speed for this facility, in watts per minute
     * @param {HTMLElement} div The HTML element corresponding to the this facility
     */
    function update_power_generating_facilities_data(data, div) {
        // This data is shared only with power and storage facilities
        div.querySelector("#power_generation").innerHTML = format_power(data.power_generation);
        if (data.ramping_speed != null) {
            div.querySelector("#ramping_speed").innerHTML = format_power(data.ramping_speed) + "/min";
        }
    }
    /**
     * Updates the level of a particular facility's div element
     * 
     * @param {Object} data The new data for this facility
     * @param {string} data.name The name of this facility
     * @param {number} data.level The level for this facility
     * @param {HTMLElement} div The HTML element corresponding to the this facility
     */
    function update_level_data(data, div) {
        // Shared among functional facilities and technologies
        div.querySelector("#lvl").innerHTML = data.level;
        if (data.name != "mathematics") {
            div.querySelector("#upgrade").innerHTML = "lvl " + (data.level - 1) + " -> lvl " + data.level;
        }
    }
    if (path == "power_facilities" && "power_facilities" in pages_data) {
        // The page for power facilities is currently open, and new relevant data was sent by the server
        let power_facilities_data = pages_data.power_facilities;
        for (let data of power_facilities_data) {
            let div = document.getElementById(data.name);
            update_base_data(data, div, on_technologies_page = false);
            update_polluting_projects(data, div);
            update_buildings_data(data, div);
            update_power_generating_facilities_data(data, div);
            if ("pollution" in data) {
                div.querySelector("#pollution").innerHTML = format_mass(data.pollution) + "/MWh";
            }
            for (let resource in data.consumed_resources) {
                var newInnerHTML = "";
                if (resource == "coal" || resource == "gas") {
                    newInnerHTML = format_mass(data.consumed_resources[resource]) + "/MWh";
                } else if (resource == "uranium") {
                    if (data.name == "nuclear_reactor") {
                        newInnerHTML = Math.round(1000 * data.consumed_resources[resource]) + " g/MWh";
                    } else {
                        newInnerHTML = Math.round(100000 * data.consumed_resources[resource]) / 100 + " g/MWh";
                    }
                } else {
                    // This case treats irradiance, wind, ... no html to update
                    continue;
                }
                div.querySelector("#" + resource + "_consumption").innerHTML = newInnerHTML;
            }
        }
    }
    if (path == "storage_facilities" && "storage_facilities" in pages_data) {
        // The page for storage facilities is currently open, and new relevant data was sent by the server
        let storage_facilities_data = pages_data.storage_facilities;
        for (let data of storage_facilities_data) {
            let div = document.getElementById(data.name);
            update_base_data(data, div, on_technologies_page = false);
            update_polluting_projects(data, div);
            update_buildings_data(data, div);
            update_power_generating_facilities_data(data, div);
            div.querySelector("#storage_capacity").innerHTML = format_energy(data.storage_capacity);
            div.querySelector("#efficiency").innerHTML = Math.round(data.efficiency) + "%";
        }
    }
    if (path == "extraction_facilities" && "extraction_facilities" in pages_data) {
        // The page for extraction facilities is currently open, and new relevant data was sent by the server
        let extraction_facilities_data = pages_data.extraction_facilities;
        for (let data of extraction_facilities_data) {
            let div = document.getElementById(data.name);
            update_base_data(data, div, on_technologies_page = false);
            update_polluting_projects(data, div);
            update_buildings_data(data, div);
            div.querySelector("#power_consumption").innerHTML = format_power(data.power_consumption);
            div.querySelector("#pollution").innerHTML = format_mass(data.pollution) + "/t";
            div.querySelector("#" + data.resource_production.name + "_production").innerHTML =
                format_mass(data.resource_production.rate) + "/h";
        }
    }
    if (path == "functional_facilities" && "functional_facilities" in pages_data) {
        // The page for functional facilities is currently open, and new relevant data was sent by the server
        let functional_facilities_data = pages_data.functional_facilities;
        for (let data of functional_facilities_data) {
            let div = document.getElementById(data.name);
            if (div == null) {
                // This is the edge case where a functional facility is unlocked after the player has already opened the
                // page. This can happen with the "carbon_capture" facility, for example. In this case, the page is 
                // reloaded, and the Jinja template will render the new facility.
                location.reload();
                return;
            }
            update_base_data(data, div, on_technologies_page = false);
            update_polluting_projects(data, div);
            if ("average_consumption" in data) {
                div.querySelector("#average_consumption").innerHTML = format_upgrade_power(
                    data.average_consumption.current,
                    data.average_consumption.upgraded
                );
            }
            if ("revenue_generation" in data) {
                div.querySelector("#revenue_generation").innerHTML = format_upgrade_money(
                    data.revenue_generation.current,
                    data.revenue_generation.upgraded
                );
            }
            if ("research_speed_bonus" in data) {
                div.querySelector("#research_speed_bonus").innerHTML =
                    "+" + Math.round(data.research_speed_bonus) + "%";
            }
            if ("lab_workers" in data) {
                div.querySelector("#lab_workers_tr").style = data.lab_workers == null ? "display:none" : "";
                if (data.lab_workers != null) {
                    div.querySelector("#lab_workers").innerHTML =
                        data.lab_workers.current + " -> " + data.lab_workers.upgraded;
                }
            }
            if ("warehouse_capacities" in data) {
                for (const resource of ["coal", "gas", "uranium"]) {
                    div.querySelector("#" + resource).innerHTML = format_upgrade_mass(
                        data.warehouse_capacities[resource].current,
                        data.warehouse_capacities[resource].upgraded
                    );
                }
            }
            if ("power_consumption" in data) {
                div.querySelector("#power_consumption").innerHTML =
                    format_upgrade_power(data.power_consumption.current, data.power_consumption.upgraded);
            }
            if ("co2_absorption" in data) {
                div.querySelector("#co2_absorption").innerHTML =
                    format_upgrade_mass_rate(data.co2_absorption.current, data.co2_absorption.upgraded);
            }
            update_level_data(data, div);
        }
    }
    if (path == "technology" && "technologies" in pages_data) {
        // The page for technologies is currently open, and new relevant data was sent by the server
        let technologies = pages_data.technologies;
        for (let data of technologies) {
            let div = document.getElementById(data.name);
            update_base_data(data, div, on_technologies_page = true);
            update_level_data(data, div);
            const knowledge_spillover_span = div.querySelector("#knowledge_spillover_discount_span");
            if ("discount" in data) {
                // Unhide the discount span if there is a discount
                knowledge_spillover_span.style = "";
                const knowledge_spillover_discount_em = div.querySelector("#knowledge_spillover_discount_em");
                knowledge_spillover_discount_em.innerHTML = `(-${Math.round(100 - 100 * data.discount)}%)`;
            } else {
                // Hide the discount span if there is no discount
                knowledge_spillover_span.style = "display:none";
            }
            /**
             * Modifies the corresponding technology's effect table for a particular entry determined by `key`
             * 
             * @param {string} key the name of the key in the data object to update, also the ID of the HTML element to 
             * update
             * @param {string} [sign="+"] The sign to use, prepended to the data
             * @param {number} [precision=0] if rounding is enabled, the number of significant digits to show
             * @param {string} [suffix="%"] Appended at the end fo the data
             * @param {boolean} [round_value=true] Enables rounding
             * @param {string} [hover_info=null] Text to show on hoover, if applicable
             * @returns 
             */
            function effect_helper(key, sign = "+", precision = 0, suffix = "%", round_value = true, hover_info = null) {
                if (data[key] == null) {
                    return;
                }
                var value = sign;
                if (round_value) {
                    value += Math.round(data[key] * Math.pow(10, precision)) / Math.pow(10, precision);
                } else {
                    value += data[key];
                }
                value += suffix;
                if (hover_info != null) {
                    value += `<span class="popup_info small">${hover_info}</span>`;
                }
                div.querySelector("#" + key).innerHTML = value;
            }
            effect_helper('power_generation_bonus');
            effect_helper("extraction_speed_bonus");
            effect_helper("fuel_use_reduction_bonus", sign = "-", precision = 1);
            effect_helper("co2_emissions_reduction_bonus", sign = "-", precision = 1);
            effect_helper("molten_salt_efficiency_bonus", sign = "+", precision = 1, suffix = "pp", round_value = true, hover_info = "percentage point");
            effect_helper("construction_time_reduction_bonus", sign = "-");
            effect_helper("shipment_time_reduction_bonus", sign = "-");
            effect_helper("power_consumption_reduction_bonus", sign = "+");
            effect_helper("power_consumption_penalty", sign = "+");
            effect_helper("co2_emissions_penalty", sign = "+");
            effect_helper("storage_capacity_bonus");
            effect_helper("hydrogen_efficiency_bonus", sign = "+", precision = 2, suffix = "pp", round_value = true, hover_info = "percentage point");
            effect_helper("lithium_ion_efficiency_bonus", sign = "+", precision = 2, suffix = "pp", round_value = true, hover_info = "percentage point");
            effect_helper("solid_state_efficiency_bonus", sign = "+", precision = 2, suffix = "pp", round_value = true, hover_info = "percentage point");
            effect_helper("price_penalty", sign = "+");
            effect_helper("price_reduction_bonus", sign = "");
            effect_helper("construction_power_reduction_bonus", sign = "-");

            if (data.hasOwnProperty("construction_workers")) {
                console.log(data.name);
                div.querySelector("#construction_workers_tr").style =
                    data.construction_workers == null ? "display:none" : "";
                if (data.construction_workers != null) {
                    div.querySelector("#construction_workers").innerHTML =
                        data.construction_workers.current + " -> " + data.construction_workers.upgraded;
                }
            }
        }
    }
});

socket.on("worker_info", function (worker_data) {
    construction_worker_cont = document.getElementById("construction_worker_cont");
    lab_worker_cont = document.getElementById("lab_worker_cont");
    if (construction_worker_cont != null) {
        construction_worker_cont.innerHTML = `${worker_data.construction_workers.available}/${worker_data.construction_workers.total}`;
    }
    if (lab_worker_cont != null) {
        lab_worker_cont.innerHTML = `${worker_data.lab_workers.available}/${worker_data.lab_workers.total}`;
    }
});