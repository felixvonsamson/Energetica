// displayed in the graph
const keys_storage = {
    "small_pumped_hydro": true,
    "large_pumped_hydro": true,
    "hydrogen_storage": true,
    "compressed_air": true,
    "molten_salt": true,
    "lithium_ion_batteries": true,
    "solid_state_batteries": true,
};

function graph_sketch(s){
    s.setup = function() {
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

    s.draw = function() {
        if (s.graphics_ready) {
            s.image(s.graphics, 0, 0);
            if (s.is_inside) {
                if (s.mouseX < s.width - 1.75 * margin) {
                    s.push();
                    s.stroke(255);
                    s.strokeWeight(2);
                    let X = min(s.graph_w, max(0, s.mouseX - margin));
                    t_view = floor(map(X, 0, s.graph_w, 0, data_len));
                    t_view = min(359, t_view + s.t0);
                    s.translate(margin + X, s.graph_h + 0.4 * margin);
                    s.line(0, 0, 0, -s.graph_h);
                    s.noStroke();

                    let count = 1;

                    s.push();
                    let sum = s.upper_bound;
                    if(s.percent == "percent"){
                        const groups = Object.keys(data.storage);
                        sum = groups.reduce((acc, group) => {
                            if (keys_storage[group] === false) {
                                return acc;
                            }
                            return acc + data.storage[group][res_id][t_view]
                        }, 0);
                    }
                    for (const group in data.storage) {
                        if (data.storage[group][res_id][t_view] > 0 && keys_storage[group]) {
                            let h = -data.storage[group][res_id][t_view] * s.graph_h / sum;
                            s.ellipse(0, h, 8, 8);
                            s.translate(0, h);
                        }
                    }
                    s.pop();

                    for(const group in data.storage){
                        if(data.storage[group][res_id][t_view] > 0 && keys_storage[group]){
                            count += 1;
                        }
                    }

                    let tx = -180;
                    let ty = - 0.4 * margin - s.graph_h + s.mouseY;
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
                    s.text(display_duration((s.t0 + data_len - t_view - 1) * res_to_factor[res]), 80, 5);
                    s.textFont(font);
                    s.translate(0, 16);
                    
                    const keys = Object.keys(data.storage).reverse();
                    for(const group of keys){
                        if(data.storage[group][res_id][t_view] > 0 && keys_storage[group]){
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
                            s.text(display_Wh(data.storage[group][res_id][t_view]), 132, 5);
                            s.translate(0, 16);
                        }
                    }
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
                    s.text("Total storage capacity", 80, 4);
                    s.textFont(font);
                    let total_cap = 0;
                    for (key in capacities) {
                        if (capacities[key] > 0 && keys_storage[key]) {
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
                            s.text(display_Wh(capacities[key]), 135, 5);
                            total_cap += capacities[key];
                        }
                    }
                    s.translate(0, 16);
                    alternate_fill(s);
                    s.rect(0, 0, 160, 17);
                    s.fill(0);
                    s.textFont(balooBold);
                    s.text("TOTAL :", 40, 5);
                    s.text(display_Wh_long(total_cap), 120, 5);
                    s.pop();
                }
            }
        }
    }

    s.mouseMoved = function() {
        if (s.mouseX>0 && s.mouseX<s.width && s.mouseY>0 && s.mouseY<s.height){
            s.is_inside = true;
            s.redraw();
        }else{
            if(s.is_inside){
                s.is_inside = false;
                s.redraw();
            }
        }
    }

    s.mouseDragged = function() {
        s.mouseMoved();
    }

    s.render_graph = function(regen_table=true){
        s.graph_h = s.height - margin;
        s.graph_w = s.width - 3 * margin;
        s.graphics.background(229, 217, 182);

        data_len = 360;
        s.t0 = 0;
        if (res == resolution_list[0]){
            data_len = 60;
            s.t0 = 300;
        }

        const sumArray = Object.entries(data.storage).reduce((acc, [key, arr]) => {
            // Skip summing if not displayed
            if (keys_storage[key] === false) {
                return acc;
            }
            arr[res_id].forEach((value, i) => {
                acc[i] = (acc[i] || 0) + value;
            });
        
            return acc;
        }, []);
        s.upper_bound = Math.max(...Object.values(sumArray));
        if (s.upper_bound == 0) {
            s.upper_bound = 100;
        }

        s.graphics.push();
        s.graphics.translate(margin, 0.4 * margin + s.graph_h);
        s.graphics.noStroke();

        s.graphics.push();
        
        for (let t = s.t0; t < s.t0+data_len; t++) {
            s.graphics.push();
            let sum = s.upper_bound;
            if(s.percent == "percent"){
                const goups = Object.keys(data.storage);
                sum = goups.reduce((acc, group) => {
                    if(keys_storage[group] === false){
                        return acc;
                    }
                    return acc + data.storage[group][res_id][t]
                }, 0);
            }
            for (const group in data.storage) {
                if (data.storage[group][res_id][t] > 0 && keys_storage[group]) {
                    s.graphics.fill(cols_and_names[group][0]);
                    let h = data.storage[group][res_id][t] * s.graph_h / sum;
                    s.graphics.rect(0, 0, s.graph_w / data_len + 1, -h - 1);
                    s.graphics.translate(0, -h);
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
        let units = time_unit(res, clock_time);
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
        if(s.percent == "percent"){
            s.upper_bound = 100;
        }
        let y_ticks3 = y_units_bounded(s.graph_h, 0, s.upper_bound, divisions=4);
        s.graphics.fill(0);
        for (let i in y_ticks3) {
            s.graphics.stroke(0, 0, 0, 30);
            s.graphics.line(s.graph_w, -i, 0, -i);
            s.graphics.stroke(0);
            s.graphics.line(0, -i, -5, -i);
            s.graphics.noStroke();
            if(s.percent == "percent"){
                s.graphics.text(y_ticks3[i] + "%", -0.5 * margin, -i + 3);
            }else{
                s.graphics.text(display_Wh(y_ticks3[i]), -0.5 * margin, -i - 3);
            }
        }
        s.graphics.pop();
        s.graphics.pop();

        s.graphics.push();
        s.graphics.translate(s.width - 0.3 * margin, 0.5 * s.height);
        s.graphics.rotate(radians(90));
        s.graphics.textSize(18);
        s.graphics.text("Total storage capacities", 0, 0);
        s.graphics.pop();
        load_player_data().then((player_data) => {
            s.graphics.push();
            s.graphics.translate(s.width - 1.5 * margin, 0.4 * margin);
            s.graphics.noStroke();
            const keys = Object.keys(keys_storage).reverse();
            capacities = {}
            for (const key of keys){
                if (key in player_data.capacities){
                    capacities[key] = player_data.capacities[key].capacity
                }
            }
            const sum = Object.entries(capacities).reduce(
                (acc, [key, currentValue]) => {
                    if(keys_storage[key] === false){
                        return acc
                    }
                    return acc + currentValue
                    }, 0);
            for (const key in capacities) {
                if (capacities[key] > 0 && keys_storage[key]) {
                    s.graphics.fill(cols_and_names[key][0]);
                    let h = (capacities[key] / sum) * s.graph_h;
                    s.graphics.rect(0, 0, 0.8 * margin, h);
                    s.graphics.translate(0, h);
                }
            }
            s.graphics.pop();

            s.graphics_ready = true;
            s.redraw();
            if(regen_table){
                sortTable(sort_by, reorder=false)
            }
        });
    } 
}

function sortTable(columnName, reorder=true) {
    const table = document.getElementById("facilities_list");
    let column = table.querySelector(`.${columnName}`);
    sort_by = columnName;

    if(reorder){
        // Check if the column is already sorted, toggle sorting order accordingly
        decending = !decending;
    }

    let triangle = ' <i class="fa fa-caret-up"></i>';
    if(decending){
        triangle = ' <i class="fa fa-caret-down"></i>';
    }

    table_content = transform_data();
    // Sort the data based on the selected column
    const sortedData = Object.entries(table_content).sort((a, b) => {
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
        <th class="color_col">#</th>
        <th class="facility_col" onclick="sortTable('facility_col')">Facility</th>
        <th class="usage_col" onclick="sortTable('usage_col')">Stored Energy</th>
        <th class="capacity_col" onclick="sortTable('capacity_col')">Max Capacity</th>
        <th class="selected_col">Displayed</th>
    </tr>`;
    for (const [id, facility] of sortedData) {
        html += `<tr>
            <td class="color_${facility.name}"></td>
            <td>${facility.facility_col}</td>
            <td>${display_Wh(facility.usage_col)}</td>
            <td>${display_Wh(facility.capacity_col)}</td>
            <td><label class="switch"><input type="checkbox" onclick="toggle_displayed('${facility.name}', ${!keys_storage[facility.name]})" ${keys_storage[facility.name] ? 'checked' : ''}><span class="slider round"></span></label></td>
            </tr>`;
    }
    table.innerHTML = html;

    // Update the sorting indicator
    column = table.querySelector(`.${columnName}`);
    column.innerHTML += triangle;

    function transform_data(){
        let transformed_data = [];
        for (const key in capacities) {
            transformed_data.push({
                name: key,
                facility_col: cols_and_names[key][1],
                usage_col: data.storage[key][0][359],
                capacity_col: capacities[key],
            })
        }
        return transformed_data;
    }
}

function toggle_displayed(name, state) {
    keys_storage[name] = state;
    graph_p5.render_graph(regen_table=false);
    setTimeout(() => {
        sortTable(sort_by, false);
    }, 500);
    
}