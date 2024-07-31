/* 
This code generates the progress bars on top of the pages that show the facilities under construction
*/

asset_names = {
    "steam_engine": "Steam engine",
    "windmill": "Windmill",
    "watermill": "Watermill",
    "coal_burner": "Coal burner",
    "oil_burner": "Oil burner",
    "gas_burner": "Gas burner",
    "small_water_dam": "Small water dam",
    "onshore_wind_turbine": "Onshore wind turbine",
    "combined_cycle": "Combined cycle",
    "nuclear_reactor": "Nuclear reactor",
    "large_water_dam": "Large water dam",
    "CSP_solar": "Concentrated solar power",
    "PV_solar": "Photovoltaics",
    "offshore_wind_turbine": "Offshore wind turbine",
    "nuclear_reactor_gen4": "4th generation nuclear",
    "small_pumped_hydro": "Small pumped hydro",
    "compressed_air": "Compressed air",
    "molten_salt": "Molten salt",
    "large_pumped_hydro": "Large pumped hydro",
    "hydrogen_storage": "Hydrogen hydrolysis",
    "lithium_ion_batteries": "Lithium-ion batteries",
    "solid_state_batteries": "Solid state batteries",
    "laboratory": "Laboratory",
    "warehouse": "Warehouse",
    "industry": "Industry",
    "carbon_capture": "Carbon capture",
    "coal_mine": "Coal mine",
    "oil_field": "Oil field",
    "gas_drilling_site": "Gas drilling site",
    "uranium_mine": "Uranium mine",
    "mathematics": "Mathematics",
    "mechanical_engineering": "Mechanical engineering",
    "thermodynamics": "Thermodynamics",
    "physics": "Physics",
    "building_technology": "Building Technology",
    "mineral_extraction": "Mineral extraction",
    "transport_technology": "Transport technology",
    "materials": "Materials",
    "civil_engineering": "Civil engineering",
    "aerodynamics": "Aerodynamics",
    "chemistry": "Chemistry",
    "nuclear_engineering": "Nuclear engineering",
}

resource_names = {
    "coal": "Coal",
    "gas": "Gas",
    "oil": "Oil",
    "uranium": "Uranium",
}

function format_ticks(ticks) {
    totalSeconds = ticks * in_game_seconds_per_tick;
    return format_seconds(totalSeconds, show_seconds = false);
}

function format_ticks_real_time(ticks) {
    totalSeconds = ticks * clock_time;
    return format_seconds(totalSeconds);
}

function format_seconds(totalSeconds, show_seconds = true) {
    const days = Math.floor(totalSeconds / (3600 * 24));
    const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);

    let formattedTime = "";
    if (days > 0) {
        formattedTime += `${days}d `;
    }
    if (days > 0 || hours > 0) {
        formattedTime += `${hours}h `;
    }
    if (days > 0 || hours > 0 || minutes > 0) {
        formattedTime += `${minutes}m `;
    }
    if (show_seconds) {
        formattedTime += `${seconds}s`;
    }

    return formattedTime.trim();
}

// information sent to the server when a new facility is created
function start_construction(facility, family, force = false) {
    send_form("/api/request_start_project", {
        facility: facility,
        family: family,
        force: force,
    })
        .then((response) => {
            response.json().then((raw_data) => {
                let response = raw_data["response"];
                if (response == "success") {
                    let money = raw_data["money"];
                    var obj = document.getElementById("money");
                    obj.innerHTML = format_money_long(money);
                    addToast("Construction started");
                    sessionStorage.setItem(
                        "constructions",
                        JSON.stringify(raw_data["constructions"])
                    );
                    refresh_progressBar();
                } else if (response == "areYouSure") {
                    capacity = raw_data["capacity"];
                    construction_power = raw_data["construction_power"];
                    are_you_sure_start_construction(facility, family, capacity, construction_power);
                } else if (response == "notEnoughMoneyError") {
                    addError("Not enough money");
                } else if (response == "locked") {
                    if (family == "Technologies") {
                        addError("Requirements not fulfilled");
                    } else {
                        addError("Facility is locked");
                    }
                }
            });
        })
        .catch((error) => {
            console.error(`caught error ${error}`);
        });
}

function cancel_construction(construction_id, force = false) {
    send_form("/api/request_cancel_project", {
        id: construction_id,
        force: force,
    })
        .then((response) => {
            response.json().then((raw_data) => {
                let response = raw_data["response"];
                if (response == "success") {
                    let money = raw_data["money"];
                    var obj = document.getElementById("money");
                    obj.innerHTML = format_money_long(money);
                    addToast("Construction cancelled");
                    sessionStorage.setItem(
                        "constructions",
                        JSON.stringify(raw_data["constructions"])
                    );
                    refresh_progressBar();
                } else if (response == "areYouSure") {
                    refund = raw_data["refund"];
                    are_you_sure_cancel_construction(construction_id, refund);
                }
            });
        })
        .catch((error) => {
            console.error(`caught error ${error}`);
        });
}

function pause_construction(construction_id) {
    send_form("/api/request_pause_project", {
        id: construction_id,
    })
        .then((response) => {
            response.json().then((raw_data) => {
                let response = raw_data["response"];
                if (response == "success") {
                    sessionStorage.setItem(
                        "constructions",
                        JSON.stringify(raw_data["constructions"])
                    );
                    refresh_progressBar();
                }
                else if (response == "parallelization not allowed") {
                    addError("Consecutive upgrades of the same asset cannot be paralelized.");
                }
            });
        })
        .catch((error) => {
            console.error(`caught error ${error}`);
        });
}

function pause_shipment(shipment_id) {
    send_form("/api/request_pause_shipment", {
        id: shipment_id,
    })
        .then((response) => {
            response.json().then((raw_data) => {
                let response = raw_data["response"];
                if (response == "success") {
                    sessionStorage.setItem(
                        "shipments",
                        JSON.stringify(raw_data["shipments"])
                    );
                    refresh_progressBar();
                }
            });
        })
        .catch((error) => {
            console.error(`caught error ${error}`);
        });
}

function decrease_project_priority(construction_id) {
    send_form("/api/request_decrease_project_priority", {
        id: construction_id,
    })
        .then((response) => {
            response.json().then((raw_data) => {
                let response = raw_data["response"];
                if (response == "success") {
                    sessionStorage.setItem(
                        "constructions",
                        JSON.stringify(raw_data["constructions"])
                    );
                    refresh_progressBar();
                }
            });
        })
        .catch((error) => {
            console.error(`caught error ${error}`);
        });
}

let constructions_data, shipment_data;
let progressBars = document.getElementsByClassName("progressbar-bar");
let shipmentBars = document.getElementsByClassName("shipmentbar-bar");
load_constructions().then((constructions) => {
    constructions_data = constructions;
    setInterval(() => {
        for (const progressBar of progressBars) {
            const id = progressBar.id;
            const construction = constructions_data[0][id];
            const now = new Date().getTime() / 1000;
            const current_time = (now - server_start) / clock_time;
            let new_width;
            let time_remaining;
            if (construction.suspension_time) {
                new_width =
                    ((construction.suspension_time -
                        construction.start_time) /
                        construction.duration) *
                    100;
                time_remaining =
                    construction.duration +
                    construction.start_time -
                    construction.suspension_time;
            } else {
                new_width =
                    ((current_time - construction.start_time) /
                        construction.duration) *
                    100;
                time_remaining =
                    construction.duration + construction.start_time - current_time;
            }
            progressBar.style.setProperty("--width", new_width);
            if (new_width > 0.01) {
                progressBar.classList.add("pine");
            }
            if (time_remaining < 0) {
                progressBar.parentElement.parentElement.remove();
                setTimeout(() => {
                    retrieve_constructions().then((construction_list) => {
                        constructions_data = construction_list;
                        display_progressBars(constructions_data, null);
                    });
                }, 1000);
            }
            const time = format_ticks(time_remaining);
            const real_time = format_ticks_real_time(time_remaining);
            progressBar.innerHTML = `&nbsp; <span class="hover_info">${time}<span class="popup_info small">in-game time</span></span> &ensp; <span class="transparency_txt hover_info">(${real_time})<span class="popup_info small">real time</span></span>`;
        }
        for (const shipmentBar of shipmentBars) {
            const id = shipmentBar.id;
            const shipment = shipment_data[id];
            const now = new Date().getTime() / 1000;
            const current_time = (now - server_start) / clock_time;
            let new_width;
            let time_remaining;
            if (shipment["suspension_time"]) {
                new_width =
                    ((shipment["suspension_time"] -
                        shipment["departure_time"]) /
                        shipment["duration"]) *
                    100;
                time_remaining =
                    shipment["duration"] +
                    shipment["departure_time"] -
                    shipment["suspension_time"];
            } else {
                new_width =
                    ((current_time - shipment["departure_time"]) /
                        shipment["duration"]) *
                    100;
                time_remaining =
                    shipment["duration"] + shipment["departure_time"] - current_time;
            }
            shipmentBar.style.setProperty("--width", new_width);
            if (new_width > 0.01) {
                shipmentBar.classList.add("pine");
            }
            if (time_remaining < 0) {
                shipmentBar.parentElement.parentElement.remove();
                setTimeout(() => {
                    retrieve_shipments().then((shipment_list) => {
                        shipment_data = shipment_list;
                        display_progressBars(null, shipment_data);
                    });
                }, 1000);
            }
            const time = format_ticks(time_remaining);
            const real_time = format_ticks_real_time(time_remaining);
            shipmentBar.innerHTML = `&nbsp; <span class="hover_info">${time}<span class="popup_info small">in-game time</span></span> &ensp; <span class="transparency_txt hover_info">(${real_time})<span class="popup_info small">real time</span></span>`;
        }
    }, 100);
});

function refresh_progressBar() {
    load_constructions().then((construction_list) => {
        load_shipments().then((shipment_list) => {
            constructions_data = construction_list;
            shipment_data = shipment_list;
            display_progressBars(constructions_data, shipment_data);
        });
    });
}

function display_progressBars(construction_data, shipment_data) {
    if (document.title == "Home") {
        if (construction_data != null) {
            const uc = document.getElementById("under_construction");
            const ur = document.getElementById("under_research");
            uc.innerHTML = "";
            ur.innerHTML = "";
            construction_priority = construction_data[1];
            research_priority = construction_data[2];
            if (construction_priority.length > 0) {
                uc.innerHTML = "<h1>&emsp;Constructions</h1>";
            }
            if (research_priority.length > 0) {
                ur.innerHTML = "<h1>&emsp;Researches</h1>";
            }
            for (const [index, c_id] of research_priority.entries()) {
                construction = construction_data[0][c_id];
                ur.innerHTML += html_for_progressBar(c_id, index, research_priority, construction);
            }
            for (const [index, c_id] of construction_priority.entries()) {
                construction = construction_data[0][c_id];
                uc.innerHTML += html_for_progressBar(c_id, index, construction_priority, construction);
            }
        }
        if (shipment_data != null) {
            const us = document.getElementById("shipments");
            us.innerHTML = "";
            if (Object.keys(shipment_data).length > 0) {
                us.innerHTML = "<h1>&emsp;Shipments</h1>";
            }
            for (var id in shipment_data) {
                shipment = shipment_data[id];
                us.innerHTML += html_for_shipmentBar(id, shipment);
            }
        }
    } else {
        const uc = document.getElementById("under_construction");
        if (uc != null) {
            if (document.title == "Resource market" && shipment_data != null) {
                uc.innerHTML = "";
                for (var id in shipment_data) {
                    shipment = shipment_data[id];
                    uc.innerHTML += html_for_shipmentBar(id, shipment);
                }
                return
            }
            if (construction_data != null) {
                uc.innerHTML = "";
                if (document.title == "Technologies") {
                    project_priority = construction_data[2];
                } else {
                    project_priority = construction_data[1];
                }
                for (const [index, c_id] of project_priority.entries()) {
                    construction = construction_data[0][c_id];
                    if (construction["family"] == document.title) {
                        uc.innerHTML += html_for_progressBar(c_id, index, project_priority, construction);
                    }
                }
            }
        }
    }
}


function html_for_progressBar(c_id, index, project_priority, construction) {
    let playPauseLogo = "fa-pause";
    if (construction["suspension_time"]) {
        playPauseLogo = "fa-play";
    }
    return `
    <div class="progressbar-container">
        <div class="progressbar-arrowcontainer">
            ${index > 0 ? `
                <button class="progressbar-arrow progressbar-button" onclick="decrease_project_priority(${project_priority[index - 1]})">
                    <i class="fa fa-caret-up"></i>
                </button>` : ''}
            ${index + 1 != project_priority.length ? `
                <button class="progressbar-arrow progressbar-button" onclick="decrease_project_priority(${c_id})">
                    <i class="fa fa-caret-down"></i>
                </button>` : ''}
        </div>
        <div class="progressbar-name medium margin-small">${asset_names[construction["name"]]}</div>
        <div class="progressbar-background">
            <div id="${c_id}" class="progressbar-bar"></div>
        </div>
        <button class="progressbar-icon progressbar-button" onclick="pause_construction(${c_id})">
            <i class="fa ${playPauseLogo}"></i>
        </button>
        <button class="progressbar-icon progressbar-button" onclick="cancel_construction(${c_id})">
            <i class="fa fa-times"></i>
        </button>
    </div>`;
}

function html_for_shipmentBar(id, shipment) {
    let playPauseLogo = "fa-pause";
    if (shipment["suspension_time"]) {
        playPauseLogo = "fa-play";
    }
    return `<div class="progressbar-container">
        <div class="progressbar-name medium margin-small">${format_mass(shipment["quantity"])} ${resource_names[shipment["resource"]]}</div>
        <div class="progressbar-background">
            <div id="${id}" class="shipmentbar-bar"></div>
        </div>
        <button class="progressbar-icon progressbar-button" onclick="pause_shipment(${id})">
            <i class="fa ${playPauseLogo}"></i>
        </button>
    </div>`;
}