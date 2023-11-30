/* 
This code is the p5.js script that eshows the map in the home screen
*/

max_q = [1, 1, 5, 25000000000, 7000000000, 1200000000, 100000000]
// Tile item :
class Hex {
  constructor(_id, _q, _r, _ressources, player) {
    this.id = _id; // Tile id
    this.q = _q; // q coordinate
    this.r = _r; // r coordinate
    this.s = -this.q - this.r; // s coordinate
    this.ressources = _ressources; // array with amount of ressources on the tile. Format : [solar, wind, hydro, coal, oil, gas, uranium]
    this.owner = player;
  }
  display_tile(hover = false) {
    let tx = w * this.q + 0.5 * w * this.r;
    let ty = 1.5 * s * this.r;
    push();
    translate(tx, ty);
    if (hover){
      fill(104, 45, 55);
    }else if (this.owner){
      fill(color(131,52, 33));
    }else{
      fill(color(45, 21, 90));
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
    if (this.owner){
      textSize(20);
      fill(255);
      text(this.owner.slice(0, 3), 0, -4);
    }
    pop();
  }
}

let h, w;
let size_param = 10; //indicates the size of the map
let s = 280 / size_param; //displayed size of the hexagon tiles
let mapsize = size_param * (size_param + 1) * 3 + 1; //lenght of the list that contains the hexagon tiles
let map = [];
let resources = [
  "Solar",
  "Wind",
  "Hydro",
  "Coal",
  "Gas",
  "Oil",
  "Uranium",
];
let validate;
let resource_colors = [59, 186, 239, 0, 320, 275, 109];
let player_tile_id;

function preload() {
  font = loadFont('static/fonts/Baloo2-VariableFont_wght.ttf');
  //filling map
  fetch("/get_map?with_id=true") // retrieves map data from the database using api.py
    .then((response) => response.json())
    .then((raw_data) => {
      data = raw_data[0];
      player_tile_id = raw_data[1]-1;
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
    })
    .catch((error) => {
      console.error("Error:", error);
    });
}

function setup() {
  let canvas_width = 0.7*windowWidth
  let canvas_height = 0.6*windowWidth
  if (windowWidth<1200){
    canvas_width = windowWidth
    canvas_height = 0.86*windowWidth
  }
  let canvas = createCanvas(min(canvas_width, 1200), min(canvas_height, 950));
  canvas.parent("map_visalisation");
  colorMode(HSB);
  textFont(font);
  textAlign(CENTER, CENTER);
  s = min(280, 0.26*width) / size_param;
  h = 2 * s;
  w = sqrt(3) * s;
}

function draw() {
  if (map.length == 0){
    return
  }
  background(83, 35, 75);
  push();
  translate(0.5 * width, 0.5 * height);
  // display tiles :
  for (let i = 0; i < map.length; i++) {
    map[i].display_tile();
  }
  let id = mouse_to_id(mouseX, mouseY);
  if (id < map.length) {
    map[id].display_tile(hover = true);
    let tx = w * map[id].q + 0.5 * w * map[id].r + 40;
    let ty = 1.5 * s * map[id].r - 40;
    if (tx+200 > 0.5 * width){
      tx -= 280;
    }
    if (ty+300 > 0.5 * height){
      ty = 0.5 * height - 310
    }
    translate(tx, ty);
    stroke(255);
    fill(104, 45, 55);
    rect(0, 0, 200, 300);
    noStroke();
    textSize(25);
    if(map[id].owner){
      fill(255);
      text(map[id].owner, 100, 15);
    }else{
      fill(131,52, 33);
      text("Vacant tile", 100, 15);
    }
    for (let i = 0; i < resources.length; i++) {
      textAlign(LEFT);
      fill(255);
      textSize(15);
      text(resources[i], 10, 45 + 32*i);
      if(i>2){
        textAlign(RIGHT);
        textSize(15);
        text(convert_kg_long(map[id].ressources[i], resources[i]), 190, 45 + 32*i);
      }
      fill(83, 35, 75);
      rect(10, 59 + 32*i, 180, 5);
      let amount = map[id].ressources[i] * 180 / max_q[i];
      fill(color(resource_colors[i], 95, 95));
      rect(10, 59 + 32*i, amount, 5);
    }
    textAlign(RIGHT);
    textSize(15);
    fill(255);
    text(round(map[id].ressources[0]*1000) + " W/m²", 190, 45);
    text(round(pow(map[id].ressources[1], 0.5)*50) + " km/h", 190, 77);
    text(map[id].ressources[2] + " locations", 190, 109);
    textAlign(CENTER);
    textSize(18);
    text("Distance : "+ calc_dist(id) +" tiles", 100, 275);
  }
  pop();
}

// This function makes the link between (q, r) coordonates and the tile id.
function mouse_to_id(mouseX, mouseY) {
  let r = floor((mouseY - height / 2 + 0.75 * s) / (0.75 * h));
  let q = floor((mouseX - width / 2 + 0.5 * w - 0.5 * w * r) / w);
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
  // tile pressed : 
  // APPROXIMATIVE WAY OF LOCATING A TILE :
  let id = mouse_to_id(mouseX, mouseY);
  if (id < map.length) {
    let player = map[id].owner;
    if (player){
      window.location.href = `/profile?player_name=${player}`;
    }
  }
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
  return `${mass.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, "'")} tons`;
}

function general_convert(value, units){
  let unit_index = 0;
  while (value >= 1000 && unit_index < units.length - 1) {
    value /= 1000;
    unit_index += 1;
  }
  return `${value.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, "'")}${
      units[unit_index]
    }`
}

function calc_dist(id){
  let dq = map[id].q - map[player_tile_id].q
  let dr = map[id].r - map[player_tile_id].r
  return round(Math.sqrt(dq*dq + dr*dr + dq*dr),2);
}