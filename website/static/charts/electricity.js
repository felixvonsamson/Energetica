let data_gen = {};
let data_demand = {};
let graph_gen;
let graph_demand;

//The following lists are just too set the order in witch the elements are displayed on top of each other.
const keys_generation = [
  "watermill",
  "small_water_dam",
  "large_water_dam",
  "nuclear_reactor",
  "nuclear_reactor_gen4",
  "steam_engine",
  "coal_burner",
  "oil_burner",
  "gas_burner",
  "combined_cycle",
  "windmill",
  "onshore_wind_turbine",
  "offshore_wind_turbine",
  "CSP_solar",
  "PV_solar",
  "small_pumped_hydro",
  "large_pumped_hydro",
  "lithium_ion_batteries",
  "solid_state_batteries",
  "compressed_air",
  "molten_salt",
  "hydrogen_storage",
  "imports",
];

const keys_demand = [
  "coal_mine",
  "oil_field",
  "gas_drilling_site",
  "uranium_mine",
  "industry",
  "research",
  "construction",
  "transport",
  "small_pumped_hydro",
  "large_pumped_hydro",
  "lithium_ion_batteries",
  "solid_state_batteries",
  "compressed_air",
  "molten_salt",
  "hydrogen_storage",
  "exports",
  "dumping",
];

function draw() {
  if (graph_gen) {
      push();
      fill_alt = 1;
      image(graph_gen, 0, 0);
      translate(0, 10);
      push();
      stroke(255);
      strokeWeight(2);
      let X = min(graph_w, max(0, mouseX - 1.5 * margin));
      let t = floor(map(X, 0, graph_w, 0, data_len));
      X += 1.5 * margin;
      if (t == data_len) {
          t = data_len - 1;
      }
      line(X, 0, X, graph_h);
      noStroke();
      translate(X, graph_h);
      let lines = 1;
      let h_max = 0;
      let total_power = 0;
      for (const key of keys_generation) {
        if(key in data_gen){
          if (data_gen[key][t] > 1) {
              let h = (-data_gen[key][t] / maxSum_gen) * graph_h;
              ellipse(0, h, 8, 8);
              translate(0, h);
              lines += 1;
              h_max -= h;
              total_power += data_gen[key][t];
          }
        }
      }
      let tx = -180;
      let ty = 0;
      if (h_max < (lines + 1) * 16) {
          ty = h_max - (lines + 1) * 16 - 2;
      }
      if (t / data_len < 180 / graph_w) {
          tx = 20;
      }
      translate(tx, ty);
      alternate_fill();
      fill_alt = 1 - (lines % 2);
      rect(0, 0, 160, 17);
      fill(0);
      textFont(balooBold);
      text(display_duration((data_len - t - 1) * res_to_data[res][1]), 80, 5);
      textFont(font);
      translate(0, 16 * lines);
      alternate_fill();
      rect(0, 0, 160, 17);
      fill(0);
      textFont(balooBold);
      text("TOTAL :", 40, 6);
      text(display_W_long(total_power), 120, 6);
      textFont(font);
      for (const key of keys_generation) {
        if (key in data_gen){
          if (data_gen[key][t] > 1) {
              alternate_fill();
              translate(0, -16);
              rect(0, 0, 160, 17);
              push();
              fill(cols_and_names[key][0]);
              rect(0, 0, 16, 17);
              pop();
              fill(0);
              textAlign(LEFT, CENTER);
              text(cols_and_names[key][1], 20, 5);
              textAlign(CENTER, CENTER);
              text(display_W(data_gen[key][t]), 135, 5);
              fill(229, 217, 182);
          }
        }
      }
      pop();
      if (mouseY<20+graph_h){
        if ((mouseX > width - 2 * margin) & (mouseX < width - 0.5*margin)) {
            fill_alt = 1;
            push();
            noStroke();
            const keys = [...keys_generation].reverse();
            keys.splice(0, 8);
            translate(width - 2 * margin - 170, min(0.4 * height, mouseY));
            alternate_fill();
            rect(0, 0, 160, 17);
            textFont(balooBold);
            fill(0);
            text("Total generation capacity", 80, 4);
            textFont(font);
            let total_cap = 0;
            for (const key of keys) {
                if (caps[key] > 0) {
                    alternate_fill();
                    translate(0, 16);
                    rect(0, 0, 160, 17);
                    push();
                    fill(cols_and_names[key][0]);
                    rect(0, 0, 16, 16);
                    pop();
                    textAlign(LEFT, CENTER);
                    fill(0);
                    text(cols_and_names[key][1], 20, 5);
                    textAlign(CENTER, CENTER);
                    text(display_W(caps[key]), 135, 5);
                    total_cap += caps[key];
                }
            }
            translate(0, 16);
            alternate_fill();
            rect(0, 0, 160, 17);
            fill(0);
            textFont(balooBold);
            text("TOTAL :", 40, 5);
            text(display_W_long(total_cap), 120, 5);
            pop();
        }
      }
      pop();
  }
  if (graph_demand) {
    push();
    fill_alt = 1;
    translate(0, 0.5*height);
    image(graph_demand, 0, 0);
    push();
    textSize(32);
    textFont(balooBold);
    text("Consumption", 0.5*width, -40);
    pop();
    translate(0, 10);
    push();
    stroke(255);
    strokeWeight(2);
    let X = min(graph_w, max(0, mouseX - 1.5 * margin));
    let t = floor(map(X, 0, graph_w, 0, data_len));
    X += 1.5 * margin;
    if (t == data_len) {
        t = data_len - 1;
    }
    line(X, 0, X, graph_h);
    noStroke();
    translate(X, graph_h);
    let lines = 1;
    let h_max = 0;
    let total_power = 0;
    for (const key of keys_demand) {
        if (key in data_demand){
            if (data_demand[key][t] > 1) {
                let h = (-data_demand[key][t] / maxSum_demand) * graph_h;
                ellipse(0, h, 8, 8);
                translate(0, h);
                lines += 1;
                h_max -= h;
                total_power += data_demand[key][t];
            }
        }
    }
    let tx = -180;
    let ty = 0;
    if (h_max < (lines + 1) * 16) {
        ty = h_max - (lines + 1) * 16 - 2;
    }
    if (t / data_len < 180 / graph_w) {
        tx = 20;
    }
    translate(tx, ty);
    alternate_fill();
    fill_alt = 1 - (lines % 2);
    rect(0, 0, 160, 17);
    fill(0);
    textFont(balooBold);
    text(display_duration(data_len - t - 1), 80, 5);
    textFont(font);
    translate(0, 16 * lines);
    alternate_fill();
    rect(0, 0, 160, 17);
    fill(0);
    textFont(balooBold);
    text("TOTAL :", 40, 6);
    text(display_W_long(total_power), 120, 6);
    textFont(font);
    for (const key of keys_demand) {
        if (key in data_demand){
            if (data_demand[key][t] > 1) {
                alternate_fill();
                translate(0, -16);
                rect(0, 0, 160, 17);
                push();
                fill(cols_and_names[key][0]);
                rect(0, 0, 16, 17);
                pop();
                fill(0);
                textAlign(LEFT, CENTER);
                text(cols_and_names[key][1], 20, 5);
                textAlign(CENTER, CENTER);
                text(display_W(data_demand[key][t]), 135, 5);
                fill(229, 217, 182);
            }
        }
    }
    pop();
    pop();
  }
}

function regen(res) {
  file = res_to_data[res][0];
  load_chart_data()
      .then((raw_data) => {
        console.log(raw_data);
        background(229, 217, 182);
        Object.keys(raw_data["generation"]).forEach((key) => {
            data_gen[key] = reduce(raw_data["generation"][key], res);
        });
        data_len = data_gen["imports"].length;
        push();
        translate(1.5 * margin, 0.5*height - 2 * margin - 10);
        noStroke();
        const sumArray_gen = Array.from({ length: data_len }, (_, i) =>
            Object.values(data_gen).reduce((acc, arr) => acc + arr[i], 0)
        );
        maxSum_gen = Math.max(...sumArray_gen);
        if (maxSum_gen == 0) {
        maxSum_gen = 100;
        }
        push();
        for (let t = 0; t < data_len; t++) {
            push();
            for (const key of keys_generation) {
                if(key in data_gen){
                    if (data_gen[key][t] > 1) {
                        fill(cols_and_names[key][0]);
                        let h = (data_gen[key][t] / maxSum_gen) * graph_h;
                        rect(0, 0, graph_w / data_len + 1, -h - 1);
                        translate(0, -h);
                    }
                }
            }
            pop();
            translate(graph_w / data_len, 0);
        }
        pop();
        stroke(0);
        line(0, 0, graph_w, 0);
        line(0, 0, 0, -graph_h);

        push();
        let units = time_unit(res);
        fill(0);
        for (let i = 0; i < units.length; i++) {
            stroke(0, 0, 0, 30);
            let x = (i * graph_w) / (units.length - 1);
            line(x, -graph_h, x, 0);
            stroke(0);
            line(x, 0, x, 5);
            noStroke();
            text(units[i], x, 0.3 * margin);
        }
        pop();

        push();
        let y_ticks = y_units(maxSum_gen);
        let interval = y_ticks[1];
        fill(0);
        let y = map(interval, 0, maxSum_gen, 0, graph_h);
        for (let i = 0; i < y_ticks.length; i++) {
            stroke(0, 0, 0, 30);
            line(graph_w, -y * i, 0, -y * i);
            stroke(0);
            line(0, -y * i, -5, -y * i);
            noStroke();
            text(display_W(y_ticks[i]), -0.75 * margin, -y * i - 4);
        }
        pop();
        pop();

        push();
        translate(width - 0.3 * margin, 0.5 * graph_h+10);
        rotate(radians(90));
        textSize(18);
        text("Total generation capacities (storage not included)", 0, 0);
        pop();
        push();
        translate(width - 1.75 * margin, graph_h+10);
        noStroke();
        // const sum = Object.values(raw_data[3]).reduce(
        //     (acc, currentValue) => acc + currentValue,
        //     0
        // );
        // for (const key of keys_generation) {
        //     if (raw_data[3][key] > 0) {
        //         fill(cols_and_names[key][0]);
        //         let h = (raw_data[3][key] / sum) * graph_h;
        //         rect(0, 0, margin*0.9, -h - 1);
        //         translate(0, -h);
        //     }
        // }
        pop();
        graph_gen = get();

        background(229, 217, 182);
        Object.keys(raw_data["demand"]).forEach((key) => {
            data_demand[key] = reduce(raw_data["demand"][key], res);
        });
        data_len = data_demand["exports"].length;
        push();
        translate(1.5 * margin, 0.5*height - 2 * margin - 10);
        noStroke();
        const sumArray_demand = Array.from({ length: data_len }, (_, i) =>
            Object.values(data_demand).reduce((acc, arr) => acc + arr[i], 0)
        );
        maxSum_demand = Math.max(...sumArray_demand);
        if (maxSum_demand == 0) {
            maxSum_demand = 100;
        }
        push();
        for (let t = 0; t < data_len; t++) {
            push();
            for (const key of keys_demand) {
                if (key in data_demand){
                    if (data_demand[key][t] > 1) {
                        fill(cols_and_names[key][0]);
                        let h = (data_demand[key][t] / maxSum_demand) * graph_h;
                        rect(0, 0, graph_w / data_len + 1, -h - 1);
                        translate(0, -h);
                    }
                }
            }
            pop();
            translate(graph_w / data_len, 0);
        }
        pop();
        stroke(0);
        line(0, 0, graph_w, 0);
        line(0, 0, 0, -graph_h);

        push();
        units = time_unit(res);
        fill(0);
        for (let i = 0; i < units.length; i++) {
            stroke(0, 0, 0, 30);
            let x = (i * graph_w) / (units.length - 1);
            line(x, -graph_h, x, 0);
            stroke(0);
            line(x, 0, x, 5);
            noStroke();
            text(units[i], x, 0.3 * margin);
        }
        pop();

        push();
        y_ticks = y_units(maxSum_demand);
        interval = y_ticks[1];
        fill(0);
        y = map(interval, 0, maxSum_demand, 0, graph_h);
        for (let i = 0; i < y_ticks.length; i++) {
            stroke(0, 0, 0, 30);
            line(graph_w, -y * i, 0, -y * i);
            stroke(0);
            line(0, -y * i, -5, -y * i);
            noStroke();
            text(display_W(y_ticks[i]), -0.75 * margin, -y * i - 4);
        }
        pop();
        pop();

        for (let i = 0; i < buttons.length; i++) {
            push();
            translate(
                1.5 * margin + (i * graph_w) / buttons.length,
                0.5*height - margin - 10
            );
            buttons[i].display_button();
            pop();
        }
        graph_demand = get();
    })
    .catch((error) => {
        console.error("Error:", error);
    });
}

function calc_size() {
  graph_h = 0.5*height - 2 * margin - 20;
  graph_w = width - 4 * margin;
}

