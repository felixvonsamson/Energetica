/* 
This code is the p5.js script that enables the player to choose a location on an
interactive map just after having registerd to the game.
*/

max_q = [1, 1, 5, 25000000000, 7000000000, 1200000000, 100000000]
// Tile item :
class Hex {
  constructor(_id, _q, _r, _ressources, player) {
    this.id = _id; // Tile id
    this.q = _q; // q coordinate
    this.r = _r; // r coordinate
    this.s = -this.q - this.r; // s coordinate
    this.selected = false; // true if tile is selected
    this.ressources = _ressources; // array with amount of ressources on the tile. Format : [solar, wind, hydro, coal, oil, gas, uranium]
    this.owner = player;
  }
  display_tile() {
    if (active_vew >= 0) {
      fill(
        color(
          button_colors[active_vew],
          this.ressources[active_vew] * 100 / max_q[active_vew],
          100,
        ),
      );
    } else if (this.owner){
      fill(color(131,52, 33));
    }else{
      fill(color(45, 21, 90));
    }
    if (this.selected == true) {
      strokeWeight(4);
    }
    beginShape();
    vertex(0, s);
    vertex(0.5 * w, 0.5 * s);
    vertex(0.5 * w, -0.5 * s);
    vertex(0, -s);
    vertex(-0.5 * w, -0.5 * s);
    vertex(-0.5 * w, 0.5 * s);
    endShape(CLOSE);
    fill(0);
    if (active_vew >= 0) {
      textSize(15);
      if (active_vew == 0 | active_vew == 1){
        text(round(this.ressources[active_vew]*100)+"%", 0, -3);
      }else if (active_vew == 2){
        textSize(20);
        text(this.ressources[active_vew], 0, -4);
      }else{
        text(convert_kg(this.ressources[active_vew]), 0, -3);
      }
    } else if (this.owner){
      textSize(20);
      fill(255);
      text(this.owner.slice(0, 3), 0, -4);
    }
  }
}

class Button {
  constructor(_name, _id, hue, x, y, sx=200, sy=60) {
    this.name = _name;
    this.id = _id;
    this.c = color(hue, 55, 255);
    this.active = false;
    this.position = createVector(x, y);
    this.size = createVector(sx, sy);
  }
  is_clicked(){
    return mouseX>this.position.x & mouseX<this.position.x+this.size.x & mouseY>this.position.y & mouseY<this.position.y+this.size.y;
  }
  display_button(hover=false) {
    push();
    if (this.active) {
      fill(this.c);
      strokeWeight(4);
    } else if(hover){
      if(this.name == "Choose this location"){
        fill(255);
      }else{
        fill(color(83, 35, 75));
      }
      noStroke();
    }else{
      fill(color(45, 21, 90));
      noStroke();
    }
    translate(this.position.x, this.position.y);
    rect(0, 0, this.size.x, this.size.y);
    fill(0);
    textSize(30);
    text(this.name, 0.5*this.size.x, 0.38*this.size.y);
    pop();
  }
}

let h, w;
let size_param = 10; //indicates the size of the map
let s = 280 / size_param; //displayed size of the hexagon tiles
let mapsize = size_param * (size_param + 1) * 3 + 1; //lenght of the list that contains the hexagon tiles
let map = [];
let buttons = [];
let validate;
let button_colors = [59, 186, 239, 0, 320, 275, 109];
let active_vew = -1;
let selected_id = null;

function preload() {
  font = loadFont('static/fonts/Baloo2-VariableFont_wght.ttf');
  font_logo = loadFont('static/fonts/ExpletusSans-SemiBold.ttf');
  logo = loadImage('static/images/icon_green.svg');
  //filling map
  fetch("/get_map") // retrieves map data from the database using api.py
    .then((response) => response.json())
    .then((data) => {
      for (let i = 0; i < data.length; i++) {
        let resources = [
          data[i].solar,
          data[i].wind,
          data[i].hydro,
          data[i].coal,
          data[i].gas,
          data[i].oil,
          data[i].uranium,
        ];
        map.push(new Hex(data[i].id, data[i].q, data[i].r, resources, data[i].player));
      }
      newdraw();
    })
    .catch((error) => {
      console.error("Error:", error);
    });
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB);
  textFont(font);
  textAlign(CENTER, CENTER);

  let button_names = [
    "Solar",
    "Wind",
    "Hydro",
    "Coal",
    "Gas",
    "Oil",
    "Uranium",
  ];
  h = 2 * s;
  w = sqrt(3) * s;
  
  for (let i = 0; i < button_names.length; i++) {
    buttons[i] = new Button(button_names[i], i, button_colors[i], 0.25*(width-(2*size_param+1)*w)-100, 0.5*(height-660)+100*i);
  }
  validate = new Button("Choose this location", 7, 24, width-350, height-100, sx=300);
  newdraw();
}

function draw() {
  for (let i = 0; i < buttons.length; i++) {
    if(buttons[i].is_clicked()){
      buttons[i].display_button(hover=true);
    }else{
      buttons[i].display_button();
    }
  }
  if(validate.is_clicked()){
    validate.display_button(hover=true);
  }else{
    validate.display_button();
  }
}

function newdraw() {
  background(104, 45, 55);
  push();
  fill(color(83, 35, 75));
  noStroke();
  rect(0, 0, 390, 100);
  image(logo, 25, 10, 82, 80);
  textFont(font_logo, 50);
  fill(color(131,52, 33));
  text("Energetica", 230, 40);
  pop();
  push();
  translate(0.5 * width, 0.5 * height);
  // display tiles :
  for (let i = 0; i < map.length; i++) {
    let h = map[i];
    let tx = w * h.q + 0.5 * w * h.r;
    let ty = 1.5 * s * h.r;
    push();
    translate(tx, ty);
    h.display_tile();
    pop();
  }
  if(selected_id != null){
    let h = map[selected_id]
    let tx = w * h.q + 0.5 * w * h.r;
    let ty = 1.5 * s * h.r;
    push();
    translate(tx, ty);
    h.display_tile();
    pop();
  }
  pop();
  push();
  mw = min(0.5*width-(1+size_param)*w, 400);
  translate(width-mw, 0);
  noStroke();
  fill(color(83, 35, 75))
  rect(0, 0, mw, height);
  fill(0);
  if(selected_id == null){
    textSize(35);
    text("INFO", 0.5*mw, 20);
    textSize(20);
    text("Please choose an avalable location on the map. The menue on the left allows you to see where different natural resources are located on the map. The location choice is DEFINITIVE, you will not be able to change it during the game.", 20, 50, mw-40, 150);
  }else{
    textSize(35);
    text("RESOURCES", 0.5*mw, 20);
    for (let i = 0; i < buttons.length; i++) {
      textAlign(LEFT);
      fill(0);
      textSize(20);
      text(buttons[i].name, 20, 65 + 85*i);
      if(i>2){
        textAlign(RIGHT);
        textSize(15);
        text(convert_kg_long(map[selected_id].ressources[i], buttons[i].name), mw-20, 69 + 85*i);
      }
      fill(255);
      rect(20, 85 + 85*i, mw-40, 40);
      let amount = map[selected_id].ressources[i] * (mw-40) / max_q[i];
      fill(color(button_colors[i], 95, 95));
      rect(20, 85 + 85*i, amount, 40);
    }
    textAlign(RIGHT);
    textSize(15);
    fill(0);
    text(round(map[selected_id].ressources[0]*1000) + " W/m² irradiation", mw-20, 69);
    text(round(pow(map[selected_id].ressources[1], 0.5)*50) + " km/h windspeed", mw-20, 154);
    text(map[selected_id].ressources[2] + " suitable locations", mw-20, 239);
    textAlign(CENTER);
    if (map[selected_id].owner){
      textSize(20);
      fill(0, 99, 66);
      text("This tile is already occupied by " + map[selected_id].owner + " !", 0.5*mw, height-135);
    }
  }
  pop();
  // display buttons :
  for (let i = 0; i < buttons.length; i++) {
    buttons[i].display_button();
  }
  validate.display_button();
}

// This function makes the link between (q, r) coordonates and the tile id.
function coords_to_id(q, r) {
  if ((q == 0) & (r == 0)) {
    return 0;
  }
  const L = 0.5 * (abs(q) + abs(r) + abs(q + r));
  const n = 3 * L * (L - 1);
  if (q == L) {
    return n + 6 * L + r;
  }
  if (q + r == L) {
    return n + r;
  }
  if (r == L) {
    return n + L - q;
  }
  if (q == -L) {
    return n + 3 * L - r;
  }
  if (q + r == -L) {
    return n + 3 * L - r;
  }
  return n + 4 * L + q;
}

function mousePressed() {
  // button pressed : 
  if (mouseX > width/2 + w*(size_param+0.5) | mouseX < width/2 - w*(size_param+0.5)) {
    if (validate.is_clicked()){
      if (selected_id != null) {
        socket.emit("choose_location", selected_id);
      }else{
        alert("No location has been selected");
      }
    }
    for (let i = 0; i < buttons.length; i++) {
      if(buttons[i].is_clicked()){
        if(buttons[i].active) {
          buttons[i].active = false;
          active_vew = -1;
        } else {
          if (active_vew >= 0) {
            buttons[active_vew].active = false;
          }
          buttons[i].active = true;
          active_vew = buttons[i].id;
        }
        newdraw();
        return;
      }
    }
  } 
  // tile pressed : 
  else {
    // APPROXIMATIVE WAY OF LOCATING A TILE :
    let r = floor((mouseY - height / 2 + 0.75 * s) / (0.75 * h));
    let q = floor((mouseX - width / 2 + 0.5 * w - 0.5 * w * r) / w);
    let id = coords_to_id(q, r);
    if (id < map.length) {
      let h = map[id];
      if (selected_id != null) {
        map[selected_id].selected = false;
      }
      if (h.selected == true) {
        h.selected = false;
        selected_id = null;
      } else {
        h.selected = true;
        selected_id = id;
      }
    }
  }
  newdraw();
}

function convert_kg(mass) {
  if(mass ==0){
    return 0;
  }
  const units = [" kg", " t", " kt", " Mt"];
  return general_convert(mass, units);
}

function convert_kg_long(mass, resource) {
  mass /= 1000
  return `${mass.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} tons of ${resource.toLowerCase()} in the ground`;
}

function general_convert(value, units){
  let unit_index = 0;
  while (value >= 1000 && unit_index < units.length - 1) {
    value /= 1000;
    unit_index += 1;
  }
  return `${value.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, " ")}${
      units[unit_index]
    }`
}