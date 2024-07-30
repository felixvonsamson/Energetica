// displayed in the graph
const keys_revenues = {
    "industry": true,
    "exports": true,
    // O&M costs
    "watermill": true,
    "small_water_dam": true,
    "large_water_dam": true,
    "nuclear_reactor": true,
    "nuclear_reactor_gen4": true,
    "steam_engine": true,
    "coal_burner": true,
    "oil_burner": true,
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
    "compressed_air": true,
    "molten_salt": true,
    "hydrogen_storage": true,
    "coal_mine": true,
    "oil_field": true,
    "gas_drilling_site": true,
    "uranium_mine": true,

    "imports": true,
    "dumping": true,
};

function graph_sketch(s) {
    s.setup = function () {
        s.percent = "normal";
        s.is_inside = false;
        s.createCanvas(min(canvas_width, 1200), 0.55 * canvas_width);
        s.noLoop();
        s.textFont(font);
        s.textAlign(CENTER, CENTER);
        s.graphics = s.createGraphics(s.width, s.height);
        s.graphics.textAlign(CENTER, CENTER);
        s.graphics.textFont(font);
    }

    s.draw = function () {
        if (s.graphics_ready) {
            s.image(s.graphics, 0, 0);
            if (s.is_inside) {
                s.push();
                s.stroke(255);
                s.strokeWeight(2);
                let X = min(s.graph_w, max(0, s.mouseX - margin));
                t_view = floor(map(X, 0, s.graph_w, 0, data_len - 1));
                t_view = min(359, t_view + s.t0);
                s.translate(margin + X, s.graph_h * s.frac + 0.2 * margin);
                s.line(0, s.graph_h * (1 - s.frac), 0, -s.graph_h * s.frac);
                s.noStroke();

                let count = 2;

                s.push();
                let sum = {
                    positive: s.upper_bound,
                    negative: s.lower_bound,
                };
                if (s.percent == "percent") {
                    const groups = Object.keys(data.revenues).concat(Object.keys(data.op_costs));
                    sum = groups.reduce((acc, group) => {
                        if (keys_revenues[group] === true) {
                            let value;
                            if (group in data.revenues) {
                                value = data.revenues[group][res_id][t_view];
                            } else {
                                value = data.op_costs[group][res_id][t_view];
                            }
                            if (value > 0) {
                                acc.positive += value;
                            } else {
                                acc.negative += value;
                            }
                        }
                        return acc;
                    }, { positive: 0, negative: 0 });
                }
                s.push();
                for (const group in keys_revenues) {
                    let value = 0;
                    if (group in data.revenues) {
                        value = data.revenues[group][res_id][t_view];
                    }
                    if (value > 0 && keys_revenues[group]) {
                        let h = -value * s.graph_h * s.frac / sum.positive;
                        s.ellipse(0, h, 8, 8);
                        s.translate(0, h);
                        count += 1;
                    }
                }
                s.pop();
                for (const group in keys_revenues) {
                    let value = 0;
                    if (group in data.revenues) {
                        value = data.revenues[group][res_id][t_view];
                    } else if (group in data.op_costs) {
                        value = data.op_costs[group][res_id][t_view];
                    }
                    if (value < 0 && keys_revenues[group]) {
                        let h = value * s.graph_h * (1 - s.frac) / sum.negative;
                        s.ellipse(0, h, 8, 8);
                        s.translate(0, h);
                        count += 1;
                    }
                }
                s.pop();

                let tx = -190;
                let ty = - 0.2 * margin - s.graph_h + s.mouseY;
                if (ty > - count * 16) {
                    ty = - count * 16;
                }
                if (X < 190) {
                    tx = 20;
                }
                s.translate(tx, ty + (1 - s.frac) * s.graph_h);
                fill_alt = 0;
                alternate_fill(s);
                s.rect(0, 0, 170, 17);
                s.fill(0);
                s.textFont(balooBold);
                s.text(ticks_to_time((s.t0 + data_len - t_view - 1) * res_to_factor[res]), 80, 5);
                s.textFont(font);
                s.translate(0, 16);

                let cumsum = 0;
                for (const group of Object.keys(keys_revenues).reverse()) {
                    let value = 0;
                    if (group in data.revenues) {
                        value = data.revenues[group][res_id][t_view] * 3600 / in_game_seconds_per_tick;
                    } else if (group in data.op_costs) {
                        value = data.op_costs[group][res_id][t_view] * 3600 / in_game_seconds_per_tick;
                    }
                    if (value != 0 && keys_revenues[group]) {
                        cumsum += value;
                        alternate_fill(s);
                        s.rect(0, 0, 170, 17);
                        s.push();
                        s.fill(cols_and_names[group][0]);
                        s.rect(0, 0, 16, 17);
                        s.pop();
                        s.fill(0);
                        s.textAlign(LEFT, CENTER);
                        s.text(cols_and_names[group][1], 20, 5);
                        s.textAlign(CENTER, CENTER);
                        display_coin(s, format_money(value, ""), 168, 0);
                        s.translate(0, 16);
                    }
                }
                alternate_fill(s);
                s.rect(0, 0, 170, 17);
                s.fill(0);
                s.textFont(balooBold);
                s.text("TOTAL :", 40, 5);
                display_coin(s, format_money(cumsum, ""), 168, 0);
                s.pop();
            }
        }
    }

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
    }

    s.mouseDragged = function () {
        s.mouseMoved();
    }

    s.render_graph = function (regen_table = true) {
        s.graph_h = s.height - margin;
        s.graph_w = s.width - 2 * margin;
        s.graphics.background(229, 217, 182);

        data_len = 360;
        s.t0 = 0;
        if (res == resolution_list[0]) {
            data_len = 60;
            s.t0 = 300;
        }

        const sums = Object.entries(data.revenues).concat(Object.entries(data.op_costs)).reduce(
            (acc, [key, arr]) => {
                // Skip summing if not displayed
                if (keys_revenues[key] === true) {
                    arr[res_id].slice(s.t0).forEach((value, i) => {
                        if (value > 0) {
                            acc.positive[i] = (acc.positive[i] || 0) + value;
                        } else if (value < 0) {
                            acc.negative[i] = (acc.negative[i] || 0) + value;
                        }
                    });
                }
                return acc;
            },
            { positive: [0], negative: [0] }
        );

        s.lower_bound = Math.min(...Object.values(sums.negative));
        s.upper_bound = Math.max(...Object.values(sums.positive));
        if (s.upper_bound == 0 && s.lower_bound == 0) {
            s.upper_bound = 1;
        }
        s.frac = s.upper_bound / (s.upper_bound - s.lower_bound); // fraction of positive range in the graph

        s.graphics.push();
        s.graphics.translate(margin, 0.2 * margin + s.graph_h * s.frac);
        s.graphics.noStroke();

        s.graphics.push();
        for (let t = s.t0; t < s.t0 + data_len; t++) {
            s.graphics.push();
            let sum = {
                upper: s.upper_bound,
                lower: s.lower_bound,
            };
            if (s.percent == "percent") {
                let sum_revenues = Object.keys(data.revenues).reduce((acc, group) => {
                    let value = data.revenues[group][res_id][t];
                    if (keys_revenues[group] === true && value != 0) {
                        if (value > 0) {
                            acc.positive += value;
                        } else {
                            acc.negative += value;
                        }
                    }
                    return acc;
                }, { positive: 0, negative: 0 });
                let sum_costs = Object.keys(data.op_costs).reduce((acc, group) => {
                    let value = data.op_costs[group][res_id][t];
                    if (keys_revenues[group] === true && value != 0) {
                        acc += value;
                    }
                    return acc;
                }, 0);
                sum.upper = sum_revenues.positive;
                sum.lower = sum_revenues.negative + sum_costs;
            }
            s.graphics.push();
            for (const group in keys_revenues) {
                let value;
                if (group in data.revenues) {
                    value = data.revenues[group][res_id][t];
                } else {
                    continue;
                }
                if (value > 0 && keys_revenues[group]) {
                    s.graphics.fill(cols_and_names[group][0]);
                    let h = value * s.graph_h * s.frac / sum.upper;
                    s.graphics.rect(0, 0, s.graph_w / data_len + 1, -h - 1);
                    s.graphics.translate(0, -h);
                }
            }
            s.graphics.pop();
            for (const group in keys_revenues) {
                let value;
                if (group in data.revenues) {
                    value = data.revenues[group][res_id][t];
                } else if (group in data.op_costs) {
                    value = data.op_costs[group][res_id][t];
                } else {
                    continue;
                }
                if (value < 0 && keys_revenues[group]) {
                    s.graphics.fill(cols_and_names[group][0]);
                    let h = value * s.graph_h * (1 - s.frac) / sum.lower;
                    s.graphics.rect(0, 0, s.graph_w / data_len + 1, h + 1);
                    s.graphics.translate(0, h);
                }
            }
            s.graphics.pop();
            s.graphics.translate(s.graph_w / data_len, 0);
        }
        s.graphics.pop();

        s.graphics.stroke(0);
        s.graphics.line(0, 0, s.graph_w, 0);
        s.graphics.line(0, s.graph_h * (1 - s.frac), 0, -s.graph_h * s.frac);

        s.graphics.push();
        let units = time_unit(res);
        s.graphics.fill(0);
        for (let i = 0; i < units.length; i++) {
            s.graphics.stroke(0, 0, 0, 30);
            let x = (i * s.graph_w) / (units.length - 1);
            s.graphics.line(x, -s.graph_h * s.frac, x, s.graph_h * (1 - s.frac));
            s.graphics.stroke(0);
            s.graphics.line(x, 0, x, 5);
            s.graphics.noStroke();
            s.graphics.text(units[i], x, 0.26 * margin);
        }
        s.graphics.pop();

        s.graphics.push();
        if (s.percent == "percent") {
            s.lower_bound = s.lower_bound / s.upper_bound * 100;
            s.upper_bound = 100;
        }
        let y_ticks3 = y_units_bounded(s.graph_h, s.lower_bound, s.upper_bound, divisions = 4);
        s.graphics.translate(0, s.graph_h * (1 - s.frac));
        s.graphics.fill(0);
        for (let i in y_ticks3) {
            s.graphics.stroke(0, 0, 0, 30);
            s.graphics.line(s.graph_w, -i, 0, -i);
            s.graphics.stroke(0);
            s.graphics.line(-5, -i, 0, -i);
            s.graphics.noStroke();
            if (s.percent == "percent") {
                s.graphics.text(y_ticks3[i] + "%", -0.5 * margin, -i + 3);
            } else {
                display_coin(s.graphics, format_money(y_ticks3[i] * 3600 / in_game_seconds_per_tick, ""), -8, -i - 8);
            }
        }
        s.graphics.pop();

        s.graphics.pop();

        s.graphics_ready = true;
        s.redraw();
        if (regen_table) {
            sortTable(sort_by, reorder = false)
        }
    }
}

function display_coin(s, money, x, y) {
    s.push();
    s.textAlign(RIGHT, CENTER);
    s.text(money, x - 29, y + 6);
    s.image(coin, x - 26, y + 2, 12, 12);
    s.text("/h", x - 3, y + 6);
    s.pop();
}

function sortTable(columnName, reorder = true) {
    const table = document.getElementById("facilities_list");
    let column = table.querySelector(`.${columnName}`);
    sort_by = columnName;

    if (reorder) {
        // Check if the column is already sorted, toggle sorting order accordingly
        descending = !descending;
    }

    let triangle = ' <i class="fa fa-caret-up"></i>';
    if (descending) {
        triangle = ' <i class="fa fa-caret-down"></i>';
    }

    table_content = transform_data();
    // Sort the data based on the selected column
    const sortedData = Object.entries(table_content).sort((a, b) => {
        const aValue = a[1][columnName];
        const bValue = b[1][columnName];

        if (typeof aValue === "string" && typeof bValue === "string") {
            return descending ? bValue.localeCompare(aValue) : aValue.localeCompare(bValue);
        } else {
            return descending ? bValue - aValue : aValue - bValue;
        }
    });

    // Rebuild the HTML table
    let html = `<tr>
        <th class="facility_col" onclick="sortTable('facility_col')">Facility</th>
        <th class="usage_col hover_info" onclick="sortTable('usage_col')">Revenues<span class="popup_info small">over the last ${res}</span></th>
        <th class="selected_col">Displayed</th>
    </tr>`;
    for (const [id, facility] of sortedData) {
        html += `<tr>
            <td>${facility.facility_col}</td>
            <td>${format_money(facility.usage_col)}</td>
            <td><label class="switch"><input type="checkbox" onclick="toggle_displayed('${facility.name}', ${!keys_revenues[facility.name]})" ${keys_revenues[facility.name] ? 'checked' : ''}><span class="slider round"></span></label></td>
            </tr>`;
    }
    table.innerHTML = html;

    // Update the sorting indicator
    column = table.querySelector(`.${columnName}`);
    column.innerHTML += triangle;

    function transform_data() {
        let transformed_data = [];
        for (const key in data.revenues) {
            transformed_data.push({
                name: key,
                facility_col: cols_and_names[key][1],
                usage_col: integrate(data.revenues[key][res_id].slice(graph_p5.t0), res_to_factor[res]),
            })
        }
        for (const key in data.op_costs) {
            transformed_data.push({
                name: key,
                facility_col: cols_and_names[key][1],
                usage_col: integrate(data.op_costs[key][res_id].slice(graph_p5.t0), res_to_factor[res]),
            })
        }
        return transformed_data;
    }

    function integrate(array, delta) {
        // integrated the energy over the array. delta is the time step in hours
        let sum = 0;
        for (let i = 0; i < array.length; i++) {
            sum += array[i] * delta;
        }
        return sum;
    }
}

function toggle_displayed(name, state) {
    keys_revenues[name] = state;
    graph_p5.render_graph(regen_table = false);
    setTimeout(() => {
        sortTable(sort_by, false);
    }, 500);
}