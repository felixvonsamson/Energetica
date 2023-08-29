/* 
This code is the p5.js script that enables the player to choose a location on an
interactive map just after having registerd to the game.
*/

var socket = io();

// Tile item :
class Hex {
  constructor(_id, _q, _r, _ressources) {
    this.id = _id; // Tile id
    this.q = _q; // q coordinate
    this.r = _r; // r coordinate
    this.s = -this.q - this.r; // s coordinate
    this.selected = false; // true if tile is selected
    this.ressources = _ressources; // array with amount of ressources on the tile. Format : [solar, wind, hydro, coal, oil, gas, uranium]
  }
  display_tile() {
    if (active_vew >= 0) {
      fill(
        color(
          button_colors[active_vew],
          this.ressources[active_vew] * (100 - int(active_vew == 7) * 67), // ONLY WORKS FOR RESSOURCES WITH VALUE BETWEEN 0 AND 1
          100,
        ),
      );
    } else {
      fill(color(45, 21, 90));
    }
    if (this.selected == true) {
      stroke(5);
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
      text(round(this.ressources[active_vew], 2), 0, 0);
    }// else {
      //text(str(this.q) + " " + this.r, 0, -5);
      //text(this.s, 0, 10);
      //text(this.id, 0, 0);
    //}
  }
}

class Button {
  constructor(_name, _id, hue) {
    this.name = _name;
    this.id = _id;
    this.c = color(hue, 255, 255);
    this.active = false;
  }
  display_button() {
    push();
    if (this.active) {
      fill(this.c);
    } else {
      fill(180);
    }
    rect(0, 0, width / 8.0, 2 * s);
    fill(0);
    text(this.name, width / 16.0, s);
    pop();
  }
}

let h, w;
let size_param = 10; //indicates the size of the map
let s = (0.25 * 800) / size_param; //displayed size of the hexagon tiles
let mapsize = size_param * (size_param + 1) * 3 + 1; //lenght of the list that contains the hexagon tiles
let map = [];
let buttons = [];
let validate;
let button_colors = [59, 186, 239, 0, 320, 275, 109];
let active_vew = -1;
let selected_id = null;

function preload() {
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
        map.push(new Hex(data[i].id, data[i].q, data[i].r, resources));
      }
      newdraw();
    })
    .catch((error) => {
      console.error("Error:", error);
    });
}

function setup() {
  createCanvas(1200, 900);
  colorMode(HSB);
  textAlign(CENTER, CENTER);

  let button_names = [
    "solar",
    "wind",
    "hydro",
    "coal",
    "oil",
    "gas",
    "uranium",
  ];
  for (let i = 0; i < button_names.length; i++) {
    buttons[i] = new Button(button_names[i], i, button_colors[i]);
  }
  validate = new Button("VALIDATE", 7, 24);

  h = 2 * s;
  w = sqrt(3) * s;
}

function draw() {}

function newdraw() {
  background(104, 45, 55);
  push();
  translate(0.5 * width, 0.5 * (height - 2 * s));
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
  pop();
  // display ressources on selected tile :
  if (selected_id != null) {
    let h = map[selected_id];
    for (let i = 0; i < buttons.length; i++) {
      push();
      translate(0, 20 * i);
      fill(button_colors[i], 100, 100);
      rect(0, 0, h.ressources[i] * 100, 20);
      fill(0);
      text(round(h.ressources[i], 2), h.ressources[i] * 100 + 15, 10);
      pop();
    }
  }
  // display buttons :
  for (let i = 0; i < buttons.length; i++) {
    push();
    translate((i * width) / (buttons.length+1), height - 2 * s);
    buttons[i].display_button();
    pop();
  }
  translate((buttons.length * width) / (buttons.length+1), height - 2 * s);
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
  if (mouseY > height - 2 * s) {
    let i = floor((mouseX * 8) / width);
    if (i == 7) {
      if (selected_id != null) {
        socket.emit("choose_location", selected_id);
      }
      return;
    }
    if (buttons[i].active) {
      buttons[i].active = false;
      active_vew = -1;
    } else {
      if (active_vew >= 0) {
        buttons[active_vew].active = false;
      }
      buttons[i].active = true;
      active_vew = buttons[i].id;
    }
  } 
  // tile pressed : 
  else {
    // APPROXIMATIVE WAY OF LOCATING A TILE :
    let r = floor((mouseY - height / 2 + 1.75 * s) / (0.75 * h));
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