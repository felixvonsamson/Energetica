// displayed in graph
const keys_generation = {
    "watermill": true,
    "small_water_dam": true,
    "large_water_dam": true,
    "nuclear_reactor": true,
    "nuclear_reactor_gen4": true,
    "steam_engine": true,
    "coal_burner": true,
    "gas_burner": true,
    "combined_cycle": true,
    "windmill": true,
    "onshore_wind_turbine": true,
    "offshore_wind_turbine": true,
    "CSP_solar": true,
    "PV_solar": true,
    "small_pumped_hydro": true,
    "large_pumped_hydro": true,
    "lithium_ion_batteries": true,
    "solid_state_batteries": true,
    "molten_salt": true,
    "hydrogen_storage": true,
    "imports": true,
};

const storage_keys = ["small_pumped_hydro", "large_pumped_hydro", "lithium_ion_batteries", "solid_state_batteries", "molten_salt", "hydrogen_storage"];

const keys_demand = {
    "coal_mine": true,
    "gas_drilling_site": true,
    "uranium_mine": true,
    "industry": true,
    "research": true,
    "construction": true,
    "transport": true,
    "carbon_capture": true,
    "small_pumped_hydro": true,
    "large_pumped_hydro": true,
    "lithium_ion_batteries": true,
    "solid_state_batteries": true,
    "molten_salt": true,
    "hydrogen_storage": true,
    "exports": true,
    "dumping": true,
};

function graph_sketch(s) {
    s.setup = function () {
        s.percent = "normal";
        s.view = "generation";
        s.is_inside = false;
        s.createCanvas(min(canvas_width, 1200), 0.55 * canvas_width);
        s.noLoop();
        s.textFont(font);
        s.textAlign(CENTER, CENTER);
        s.graphics = s.createGraphics(s.width, s.height);
        s.graphics.textAlign(CENTER, CENTER);
        s.graphics.textFont(font);
    };

    s.draw = function () {
        if (s.graphics_ready) {
            s.image(s.graphics, 0, 0);
            if (s.is_inside) {
                if (s.mouseX < s.width - 1.2 * margin || s.view == "consumption") {
                    s.push();
                    s.stroke(255);
                    s.strokeWeight(2);
                    let X = min(s.graph_w, max(0, s.mouseX - margin));
                    t_view = floor(map(X, 0, s.graph_w, 0, data_len));
                    t_view = min(359, t_view + s.t0);
                    s.translate(margin + X, s.graph_h + 0.2 * margin);
                    s.line(0, 0, 0, -s.graph_h);
                    s.noStroke();

                    let count = 2;

                    s.push();
                    let sum = s.upper_bound;
                    if (s.percent == "percent") {
                        const groups = Object.keys(s.current_data);
                        sum = groups.reduce((acc, group) => {
                            if (s.keys[group] === false) {
                                return acc;
                            }
                            return acc + s.current_data[group][res_id][t_view];
                        }, 0);
                    }
                    for (const group in s.keys) {
                        if (group in s.current_data) {
                            if (s.current_data[group][res_id][t_view] > 1 && s.keys[group]) {
                                let h = -s.current_data[group][res_id][t_view] * s.graph_h / sum;
                                s.ellipse(0, h, 8, 8);
                                s.translate(0, h);
                            }
                        }
                    }
                    s.pop();

                    for (const group in s.current_data) {
                        if (s.current_data[group][res_id][t_view] > 1 && s.keys[group]) {
                            count += 1;
                        }
                    }

                    let tx = -180;
                    let ty = - 0.2 * margin - s.graph_h + s.mouseY;
                    if (ty > - count * 16) {
                        ty = - count * 16;
                    }
                    if (X < 180) {
                        tx = 20;
                    }
                    s.translate(tx, ty);
                    fill_alt = 0;
                    alternate_fill(s);
                    s.rect(0, 0, 160, 17);
                    s.fill(0);
                    s.textFont(balooBold);
                    s.text(ticks_to_time((s.t0 + data_len - t_view - 1) * res_to_factor[res]), 80, 5);
                    s.textFont(font);
                    s.translate(0, 16);

                    let cumsum = 0;
                    for (const group of Object.keys(s.keys).reverse()) {
                        if (group in s.current_data) {
                            if (s.current_data[group][res_id][t_view] > 1 && s.keys[group]) {
                                cumsum += s.current_data[group][res_id][t_view];
                                alternate_fill(s);
                                s.rect(0, 0, 160, 17);
                                s.push();
                                s.fill(cols_and_names[group][0]);
                                s.rect(0, 0, 16, 17);
                                s.pop();
                                s.fill(0);
                                s.textAlign(LEFT, CENTER);
                                s.text(cols_and_names[group][1], 20, 5);
                                s.textAlign(CENTER, CENTER);
                                s.text(format_power(s.current_data[group][res_id][t_view]), 132, 5);
                                s.translate(0, 16);
                            }
                        }
                    }
                    alternate_fill(s);
                    s.rect(0, 0, 160, 17);
                    s.fill(0);
                    s.textFont(balooBold);
                    s.text("TOTAL :", 40, 5);
                    s.text(format_power(cumsum, 50_000), 120, 5);
                    s.pop();

                } else {
                    fill_alt = 1;
                    s.push();
                    s.noStroke();
                    s.translate(s.width - 1.5 * margin - 170, min(0.8 * s.height, s.mouseY));
                    fill_alt = 0;
                    alternate_fill(s);
                    s.rect(0, 0, 160, 17);
                    s.textFont(balooBold);
                    s.fill(0);
                    s.text("Total generation capacity", 80, 4);
                    s.textFont(font);
                    let total_cap = 0;
                    for (const key of Object.keys(s.keys).reverse()) {
                        if (key in capacities) {
                            if (capacities[key] > 1 && s.keys[key] && !(storage_keys.includes(key))) {
                                alternate_fill(s);
                                s.translate(0, 16);
                                s.rect(0, 0, 160, 17);
                                s.push();
                                s.fill(cols_and_names[key][0]);
                                s.rect(0, 0, 16, 16);
                                s.pop();
                                s.textAlign(LEFT, CENTER);
                                s.fill(0);
                                s.text(cols_and_names[key][1], 20, 5);
                                s.textAlign(CENTER, CENTER);
                                s.text(format_power(capacities[key]), 135, 5);
                                total_cap += capacities[key];
                            }
                        }
                    }
                    s.translate(0, 16);
                    alternate_fill(s);
                    s.rect(0, 0, 160, 17);
                    s.fill(0);
                    s.textFont(balooBold);
                    s.text("TOTAL :", 40, 5);
                    s.text(format_power(total_cap, 50_000), 120, 5);
                    s.pop();
                }
            }
        }
    };

    s.mouseMoved = function () {
        if (s.mouseX > 0 && s.mouseX < s.width && s.mouseY > 0 && s.mouseY < s.height) {
            s.is_inside = true;
            s.redraw();
        } else {
            if (s.is_inside) {
                s.is_inside = false;
                s.redraw();
            }
        }
    };

    s.mouseDragged = function () {
        s.mouseMoved();
    };

    s.render_graph = function (regen_table = true) {
        s.current_data = data.generation;
        s.keys = keys_generation;
        if (s.view == "consumption") {
            s.current_data = data.demand;
            s.keys = keys_demand;
        }
        s.graph_h = s.height - margin;
        s.graph_w = s.width - 2 * margin - 0.5 * margin * (s.view == "generation");
        s.graphics.background(229, 217, 182);

        data_len = 360;
        s.t0 = 0;
        if (res == resolution_list[0]) {
            data_len = 60;
            s.t0 = 300;
        }

        const sumArray = Object.entries(s.current_data).reduce((acc, [key, arr]) => {
            // Skip summing if not displayed
            if (s.keys[key] === false) {
                return acc;
            }
            arr[res_id].slice(s.t0).forEach((value, i) => {
                acc[i] = (acc[i] || 0) + value;
            });

            return acc;
        }, []);
        s.upper_bound = Math.max(...Object.values(sumArray));
        if (s.upper_bound == 0) {
            s.upper_bound = 100;
        }

        s.graphics.push();
        s.graphics.translate(margin, 0.2 * margin + s.graph_h);
        s.graphics.noStroke();

        s.graphics.push();

        for (let t = s.t0; t < s.t0 + data_len; t++) {
            s.graphics.push();
            let sum = s.upper_bound;
            if (s.percent == "percent") {
                const goups = Object.keys(s.current_data);
                sum = goups.reduce((acc, group) => {
                    if (s.keys[group] === false) {
                        return acc;
                    }
                    return acc + s.current_data[group][res_id][t];
                }, 0);
            }
            for (const group in s.keys) {
                if (group in s.current_data) {
                    if (s.current_data[group][res_id][t] > 1 && s.keys[group]) {
                        s.graphics.fill(cols_and_names[group][0]);
                        let h = s.current_data[group][res_id][t] * s.graph_h / sum;
                        s.graphics.rect(0, 0, s.graph_w / data_len + 1, -h - 1);
                        s.graphics.translate(0, -h);
                    }
                }
            }
            s.graphics.pop();
            s.graphics.translate(s.graph_w / data_len, 0);
        }
        s.graphics.pop();

        s.graphics.stroke(0);
        s.graphics.line(0, 0, s.graph_w, 0);
        s.graphics.line(0, 0, 0, -s.graph_h);
        s.graphics.push();
        let units = time_unit(res);
        s.graphics.fill(0);
        for (let i = 0; i < units.length; i++) {
            s.graphics.stroke(0, 0, 0, 30);
            let x = (i * s.graph_w) / (units.length - 1);
            s.graphics.line(x, -s.graph_h, x, 0);
            s.graphics.stroke(0);
            s.graphics.line(x, 0, x, 5);
            s.graphics.noStroke();
            s.graphics.text(units[i], x, 0.26 * margin);
        }
        s.graphics.pop();

        s.graphics.push();
        if (s.percent == "percent") {
            s.upper_bound = 100;
        }
        let y_ticks3 = y_units_bounded(s.graph_h, 0, s.upper_bound, divisions = 4);
        s.graphics.fill(0);
        for (let i in y_ticks3) {
            s.graphics.stroke(0, 0, 0, 30);
            s.graphics.line(s.graph_w, -i, 0, -i);
            s.graphics.stroke(0);
            s.graphics.line(0, -i, -5, -i);
            s.graphics.noStroke();
            if (s.percent == "percent") {
                s.graphics.text(y_ticks3[i] + "%", -0.5 * margin, -i + 3);
            } else {
                s.graphics.text(format_power(y_ticks3[i]), -0.5 * margin, -i - 3);
            }
        }
        s.graphics.pop();
        s.graphics.pop();

        load_player_data().then((player_data) => {
            if (s.view == "generation") {
                s.graphics.push();
                s.graphics.translate(s.width - 0.25 * margin, 0.5 * s.height);
                s.graphics.rotate(radians(90));
                s.graphics.textSize(18);
                s.graphics.text("Total generation capacities (storage not included)", 0, 0);
                s.graphics.pop();
                s.graphics.push();
                s.graphics.translate(s.width - 1.1 * margin, 0.2 * margin);
                s.graphics.noStroke();
                capacities = {};
                const keys = Object.keys(keys_generation).reverse();
                for (const key of keys) {
                    if (key in player_data.capacities) {
                        capacities[key] = player_data.capacities[key].power;
                    }
                }
                const sum = Object.entries(capacities).reduce(
                    (acc, [key, currentValue]) => {
                        if (s.keys[key] === false || storage_keys.includes(key)) {
                            return acc;
                        }
                        return acc + currentValue;
                    }, 0);
                for (const key in capacities) {
                    if (capacities[key] > 1 && s.keys[key] && !(storage_keys.includes(key))) {
                        s.graphics.fill(cols_and_names[key][0]);
                        let h = (capacities[key] / sum) * s.graph_h;
                        s.graphics.rect(0, 0, 0.5 * margin, h);
                        s.graphics.translate(0, h);
                    }
                }
                s.graphics.pop();
                s.graphics.push();
                s.graphics.noFill();
                s.graphics.translate(s.width - 1.1 * margin, 0.2 * margin);
                s.graphics.rect(0, 0, 0.5 * margin, s.graph_h);
                s.graphics.pop();
            }

            s.graphics_ready = true;
            s.redraw();
            if (regen_table) {
                sortGeneratingFacilitiesTable(sort_by, reorder = false);
                sortConsumingFacilitiesTable(sort_by, reorder = false);
            }
        });
    };
}

function integrate(array, delta) {
    // integrated the energy over the array. delta is the time step in hours
    let sum = 0;
    for (let i = 0; i < array.length; i++) {
        sum += array[i] * delta;
    }
    return sum;
}

function sortGeneratingFacilitiesTable(columnName, reorder = true) {
    const table = document.getElementById("generating_facilities_table");
    table_content = [];
    for (const [key, generation_data] of Object.entries(data.generation)) {
        let cap = 0;
        if (key in capacities) {
            cap = capacities[key];
        }
        table_content.push({
            name: key,
            facility_col: cols_and_names[key][1],
            usage_col: integrate(generation_data[res_id].slice(graph_p5.t0), res_to_factor[res] * in_game_seconds_per_tick / 3600),
            capacity_col: cap === 0 ? null : cap,
            used_cap_col: cap === 0 ? null : generation_data[0][359] / cap,
        });
    }
    // Reset the table headers
    table.querySelector(".facility_col").innerHTML = "Facility";
    table.querySelector(".usage_col").innerHTML = `Generated
        <span class="popup_info bottom small">over the last ${ticks_to_time(res, prefix = "")}</span>`;
    table.querySelector(".capacity_col").innerHTML = "Installed Cap.";
    table.querySelector(".used_cap_col").innerHTML = "Used Capacity";
    sortTable(table, columnName, table_content, reorder);
}

function sortConsumingFacilitiesTable(columnName, reorder = true) {
    const table = document.getElementById("consuming_facilities_table");
    table_content = [];
    for (const [key, consumption_data] of Object.entries(data.demand)) {
        table_content.push({
            name: key,
            facility_col: cols_and_names[key][1],
            usage_col: integrate(consumption_data[res_id].slice(graph_p5.t0), res_to_factor[res] * in_game_seconds_per_tick / 3600),
        });
    }
    // Reset the table headers
    table.querySelector(".facility_col").innerHTML = "Facility";
    table.querySelector(".usage_col").innerHTML = `Generated
        <span class="popup_info bottom small">over the last ${ticks_to_time(res, prefix = "")}</span>`;
    sortTable(table, columnName, table_content, reorder);
}

function sortTable(table, column_name, table_content, reorder = true) {
    let column = table.querySelector(`.${column_name}`);
    sort_by = column_name;

    if (reorder) {
        // Check if the column is already sorted, toggle sorting order accordingly
        descending = !descending;
    }

    let triangle = ' <i class="fa fa-caret-up"></i>';
    if (descending) {
        triangle = ' <i class="fa fa-caret-down"></i>';
    }

    // Sort the data based on the selected column
    const sortedData = Object.entries(table_content).sort((a, b) => {
        const aValue = a[1][column_name];
        const bValue = b[1][column_name];

        if (typeof aValue === "string" && typeof bValue === "string") {
            return descending ? bValue.localeCompare(aValue) : aValue.localeCompare(bValue);
        } else {
            return descending ? bValue - aValue : aValue - bValue;
        }
    });

    // Rebuild the HTML table
    // remove all tr table row elements of the table
    while (table.rows.length > 1) {
        table.deleteRow(1);
    }
    let html;

    // Add the sorted data to the table
    if (table.id == "consuming_facilities_table") {
        for (const [id, facility] of sortedData) {
            table.insertRow().innerHTML = `<tr>
                    <td>${facility.facility_col}</td>
                    <td>${format_power(facility.usage_col)}</td>
                    <td>
                        <label class="switch">
                            <input type="checkbox" 
                                onclick="toggle_consumption_displayed('${facility.name}')" 
                                ${keys_demand[facility.name] ? 'checked' : ''}>
                            <span class="slider round"></span>
                        </label>
                    </td>
                </tr>`;
        }
    } else {
        for (const [id, facility] of sortedData) {
            table.insertRow().innerHTML = `<tr>
                    <td>${facility.facility_col}</td>
                    <td>${format_energy(facility.usage_col)}</td>
                    <td>${facility.capacity_col === null ? '-' : format_power(facility.capacity_col)}</td>
                    <td>
                        ${facility.used_cap_col === null
                    ? '-'
                    : `<div class="capacityJauge-background">
                                    <div class="capacityJauge color_${facility.name}" 
                                         style="--width:${facility.used_cap_col}"></div>
                                    <div class="capacityJauge-txt">${Math.round(facility.used_cap_col * 100)}%</div>
                                </div>`
                }
                    </td>
                    <td>
                        <label class="switch">
                            <input type="checkbox" 
                                   onclick="toggle_generation_displayed('${facility.name}')" 
                                   ${keys_generation[facility.name] ? 'checked' : ''}>
                            <span class="slider round"></span>
                        </label>
                    </td>
                </tr>`;
        }
    }

    // Update the sorting indicator
    column = table.querySelector(`.${column_name}`);
    column.innerHTML += triangle;
}

function toggle_generation_displayed(name) {
    set_generation_displayed(name, !keys_generation[name]);
}

function toggle_consumption_displayed(name) {
    set_consumption_displayed(name, !keys_demand[name]);
}

function set_generation_displayed(name, state) {
    keys_generation[name] = state;
    if (!state) {
        set_generating_facilities_button_role_to_show();
    } else {
        // if all generating facilities are displayed, change the button role to hide
        let all_displayed = true;
        for (const key in data.generation) {
            if (keys_generation[key] === false) {
                all_displayed = false;
                break;
            }
        }
        if (all_displayed) {
            set_generating_facilities_button_role_to_hide();
        }
    }
    graph_p5.render_graph(regen_table = false);
    setTimeout(() => {
        sortGeneratingFacilitiesTable(sort_by, false);
    }, 500);
}

function set_consumption_displayed(name, state) {
    keys_demand[name] = state;
    if (!state) {
        set_consumption_button_role_to_show();
    } else {
        // if all consuming facilities are displayed, change the button role to hide
        let all_displayed = true;
        for (const key in data.demand) {
            if (keys_demand[key] === false) {
                all_displayed = false;
                break;
            }
        }
        if (all_displayed) {
            set_consumption_button_role_to_hide();
        }
    }
    graph_p5.render_graph(regen_table = false);
    setTimeout(() => {
        sortConsumingFacilitiesTable(sort_by, false);
    }, 500);
}

function change_view(view) {
    header = document.getElementById("graph_header");
    consuming_facilities_table = document.getElementById("consuming_facilities_table");
    generating_facilities_table = document.getElementById("generating_facilities_table");
    if (view == "generation") {
        header.innerHTML = "Power Generation";
        generating_facilities_table.classList.remove("hidden");
        consuming_facilities_table.classList.add("hidden");
    } else {
        header.innerHTML = "Power Consumption";
        consuming_facilities_table.classList.remove("hidden");
        generating_facilities_table.classList.add("hidden");
    }
    show_selected_button("view_button_", view);
    graph_p5.view = view;
    graph_p5.render_graph(regen_table = false);
}

function set_all_table_toggles(table, state) {
    const rows = table.getElementsByTagName("tr");
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const checkbox = row.getElementsByTagName("input")[0];
        checkbox.checked = state;
    }
}

function hide_all_generating_facilities() {
    set_all_table_toggles(document.getElementById("generating_facilities_table"), false);
    for (const key in keys_generation) {
        keys_generation[key] = false;
    }
    graph_p5.render_graph(regen_table = false);
    set_generating_facilities_button_role_to_show();
}

function show_all_generating_facilities() {
    set_all_table_toggles(document.getElementById("generating_facilities_table"), true);
    for (const key in keys_generation) {
        keys_generation[key] = true;
    }
    graph_p5.render_graph(regen_table = false);
    set_generating_facilities_button_role_to_hide();
}

function hide_all_consuming_facilities() {
    set_all_table_toggles(document.getElementById("consuming_facilities_table"), false);
    for (const key in keys_demand) {
        keys_demand[key] = false;
    }
    graph_p5.render_graph(regen_table = false);
    set_consumption_button_role_to_show();
}

function show_all_consuming_facilities() {
    set_all_table_toggles(document.getElementById("consuming_facilities_table"), true);
    for (const key in keys_demand) {
        keys_demand[key] = true;
    }
    graph_p5.render_graph(regen_table = false);
    set_consumption_button_role_to_hide();
}

function set_generating_facilities_button_role_to_hide() {
    const button = document.getElementById("show_hide_generating_facilities_button");
    button.firstChild.innerText = "Hide all";
    button.onclick = hide_all_generating_facilities;
}

function set_generating_facilities_button_role_to_show() {
    const button = document.getElementById("show_hide_generating_facilities_button");
    button.firstChild.innerText = "Show all";
    button.onclick = show_all_generating_facilities;
}

function set_consumption_button_role_to_hide() {
    const button = document.getElementById("show_hide_consuming_facilities_button");
    button.firstChild.innerText = "Hide all";
    button.onclick = hide_all_consuming_facilities;
}

function set_consumption_button_role_to_show() {
    const button = document.getElementById("show_hide_consuming_facilities_button");
    button.firstChild.innerText = "Show all";
    button.onclick = show_all_consuming_facilities;
}