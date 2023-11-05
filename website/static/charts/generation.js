const keys_generation = ["watermill", "small_water_dam", "large_water_dam", 
  "nuclear_reactor", "nuclear_reactor_gen4", "steam_engine", "coal_burner", 
  "oil_burner", "gas_burner", "combined_cycle", "windmill", "onshore_wind_turbine", 
  "offshore_wind_turbine", "CSP_solar", "PV_solar", "small_pumped_hydro", 
  "large_pumped_hydro", "lithium_ion_batteries", "solid_state_batteries", 
  "compressed_air", "molten_salt", "hydrogen_storage", "imports"
];

function draw_generation() {
  if(graph){
    push();
    fill_alt = 1;
    image(graph, 0, 0);
    translate(0, 10);
    push();
    stroke(255);
    strokeWeight(2);
    let X = min(graph_w, max(0, mouseX-1.5*margin));
    let t = floor(map(X, 0, graph_w, 0, data_len));
    X += 1.5*margin;
    if(t == data_len){t = data_len-1;}
    line(X, 0, X, graph_h);
    noStroke();
    translate(X, graph_h);
    let lines = 1;
    let h_max = 0;
    let total_power = 0;
    for (const key of keys_generation) {
      if(data[key][t]>0){
        let h = -data[key][t]/maxSum*graph_h;
        ellipse(0, h, 8, 8);
        translate(0, h);
        lines += 1;
        h_max -= h;
        total_power += data[key][t];
      }
    }
    let tx = -180;
    let ty = 0;
    if(h_max<(lines+1)*16){
      ty = h_max-(lines+1)*16-2;
    }
    if(t/data_len < 180/graph_w){
      tx = 20;
    }
    translate(tx, ty);
    alternate_fill();
    fill_alt = 1-lines%2;
    rect(0, 0, 160, 17);
    fill(0);
    textStyle(BOLD);
    text(display_duration((data_len-t-1)*res_to_data[res][1]),80, 9);
    textStyle(NORMAL);
    translate(0, 16*lines);
    alternate_fill();
    rect(0, 0, 160, 17);
    fill(0);
    textStyle(BOLD);
    text("TOTAL :", 40, 10);
    text(display_W_long(total_power), 120, 10);
    textStyle(NORMAL);
    for (const key of keys_generation) {
      if(data[key][t]>0){
        alternate_fill();
        translate(0, -16);
        rect(0, 0, 160, 17);
        push();
        fill(cols_and_names[key][0]);
        rect(0, 0, 16, 17);
        pop();
        fill(0);
        textAlign(LEFT, CENTER);
        text(cols_and_names[key][1], 20, 9);
        textAlign(CENTER, CENTER);
        text(display_W(data[key][t]), 135, 9);
        fill(229, 217, 182);
      }
    }
    pop();
    if(mouseX>width-2*margin & mouseX<width-margin){
      fill_alt = 1;
      push();
      noStroke();
      const keys = [...keys_generation].reverse();
      keys.splice(0, 8);
      translate(width-2*margin-170, min(0.8*height, mouseY));
      alternate_fill();
      rect(0, 0, 160, 17);
      textStyle(BOLD);
      fill(0);
      text("Total generation capacity",80, 8);
      textStyle(NORMAL);
      let total_cap = 0;
      for (const key of keys) {
        if(caps[key]>0){
          alternate_fill();
          translate(0, 16);
          rect(0, 0, 160, 17);
          push();
          fill(cols_and_names[key][0]);
          rect(0, 0, 16, 16);
          pop();
          textAlign(LEFT, CENTER);
          fill(0);
          text(cols_and_names[key][1], 20, 9);
          textAlign(CENTER, CENTER);
          text(display_W(caps[key]), 135, 9);
          total_cap += caps[key];
        }
      }
      translate(0, 16);
      alternate_fill();
      rect(0, 0, 160, 17);
      fill(0);
      textStyle(BOLD);
      text("TOTAL :", 40, 9);
      text(display_W_long(total_cap), 120, 9);
      pop();
    }
    pop();
  }
}

function regen_generation(res){
  file = res_to_data[res][0]
  fetch(`/get_chart_data?timescale=${file}&table=generation`) // retrieves data from server
    .then((response) => response.json())
    .then((raw_data) => {
      background(229, 217, 182);
      caps = raw_data[3];
      data = raw_data[1];
      Object.keys(data).forEach(key => {
          const array = raw_data[2][key];
          data[key] = reduce(data[key], array, res, raw_data[0]);
        });
      data_len = data["imports"].length;
      push();
      translate(1.5*margin, height-2*margin-10);
      noStroke();
      const sumArray = Array.from({ length: data_len }, (_, i) =>
        Object.values(data).reduce((acc, arr) => acc + arr[i], 0)
      );
      maxSum = Math.max(...sumArray);
      if(maxSum == 0){
        maxSum = 100;
      }
      push();
      for(let t = 0; t < data_len; t++){
        push();
        for (const key of keys_generation) {
          if(data[key][t]>0){
            fill(cols_and_names[key][0]);
            let h = data[key][t]/maxSum*graph_h
            rect(0, 0, graph_w/data_len + 1, -h-1);
            translate(0, -h);
          }
        }
        pop();
        translate(graph_w/data_len, 0);
      }
      pop();
      stroke(0);
      line(0, 0, graph_w, 0);
      line(0, 0, 0, -graph_h);
      
      push();
      let units = time_unit(res);
      fill(0);
      for(let i=0; i<units.length; i++){
        stroke(0, 0, 0, 30);
        let x = i*graph_w/(units.length-1);
        line(x, -graph_h, x, 0);
        stroke(0);
        line(x, 0, x, 5);
        noStroke();
        text(units[i], x, 0.5*margin);
      }
      pop();

      push();
      let y_ticks = y_units(maxSum);
      let interval = y_ticks[1];
      fill(0);
      let y = map(interval, 0, maxSum, 0, graph_h);
      for(let i=0; i<y_ticks.length; i++){
        stroke(0, 0, 0, 30);
        line(graph_w, -y*i, 0, -y*i);
        stroke(0);
        line(0, -y*i, -5, -y*i);
        noStroke();
        text(display_W(y_ticks[i]),-0.75*margin, -y*i);
      }
      pop();
      pop();

      for(let i = 0; i<buttons.length; i++){
        push();
        translate(1.5*margin + i*graph_w/buttons.length, height-margin-10);
        buttons[i].display_button();
        pop();
      }
      
      push();
      translate(width-0.6*margin, 0.5*height);
      rotate(radians(90));
      textSize(18);
      text("Total generation capacities (storage not included)", 0, 0);
      pop();
      push();
      translate(width-2*margin, height-10);
      noStroke();
      const sum = Object.values(raw_data[3]).reduce((acc, currentValue) => acc + currentValue, 0);
      for (const key of keys_generation) {
        if(raw_data[3][key]>0){
          fill(cols_and_names[key][0]);
          let h = raw_data[3][key]/sum*(height-20);
          rect(0, 0, margin, -h-1);
          translate(0, -h);
        }
      }
      pop();
      graph = get();
    })
    .catch((error) => {
      console.error("Error:", error);
    });
}