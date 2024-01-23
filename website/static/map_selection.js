/* 
This code is the p5.js script that enables the player to choose a location on an
interactive map just after having registerd to the game.
*/

max_q = [1, 1, 5, 25000000000, 7000000000, 1200000000, 100000000];
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
        let ts1, ts2;
        if (width < 1200) {
            ts1 = width / 70;
            ts2 = width / 45;
        } else {
            ts1 = width / 115;
            ts2 = width / 90;
        }
        if (active_vew >= 0) {
            fill(
                color(
                    button_colors[active_vew],
                    (this.ressources[active_vew] * 100) / max_q[active_vew],
                    100
                )
            );
        } else if (this.owner) {
            fill(color(131, 52, 33));
        } else {
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
            textSize(ts1);
            if ((active_vew == 0) | (active_vew == 1)) {
                text(round(this.ressources[active_vew] * 100) + "%", 0, -3);
            } else if (active_vew == 2) {
                textSize(ts2);
                text(this.ressources[active_vew], 0, -4);
            } else {
                text(convert_kg(this.ressources[active_vew]), 0, -3);
            }
        } else if (this.owner) {
            textSize(ts2);
            fill(255);
            text(this.owner.slice(0, 3), 0, -4);
        }
    }
}

class Button {
    constructor(_name, _id, hue, x, y, sx = 200, sy = 60) {
        this.name = _name;
        this.id = _id;
        this.c = color(hue, 55, 255);
        this.active = false;
        this.position = createVector(x, y);
        this.size = createVector(sx, sy);
    }
    change_values(x, y, sx, sy) {
        this.position = createVector(x, y);
        this.size = createVector(sx, sy);
    }
    is_clicked() {
        return (
            (mouseX > this.position.x) &
            (mouseX < this.position.x + this.size.x) &
            (mouseY > this.position.y) &
            (mouseY < this.position.y + this.size.y)
        );
    }
    display_button(hover = false) {
        push();
        if (this.active) {
            fill(this.c);
            strokeWeight(4);
        } else if (hover) {
            if (this.name == "Choose this location") {
                fill(255);
            } else {
                fill(color(83, 35, 75));
            }
            noStroke();
        } else {
            fill(color(45, 21, 90));
            noStroke();
        }
        translate(this.position.x, this.position.y);
        rect(0, 0, this.size.x, this.size.y);
        fill(0);
        if (width < 1200) {
            textSize(width / 20);
        } else {
            textSize(width / 55);
        }
        text(this.name, 0.5 * this.size.x, 0.38 * this.size.y);
        pop();
    }
}

let h, w;
let size_param = 10; //indicates the size of the map
let s; //displayed size of the hexagon tiles
let mapsize = size_param * (size_param + 1) * 3 + 1; //lenght of the list that contains the hexagon tiles
let map = [];
let buttons = [];
let validate;
let button_colors = [59, 186, 239, 0, 320, 275, 109];
let active_vew = -1;
let selected_id = null;
let button_names = ["Solar", "Wind", "Hydro", "Coal", "Gas", "Oil", "Uranium"];

function preload() {
    font = loadFont("static/fonts/Baloo2-VariableFont_wght.ttf");
    font_logo = loadFont("static/fonts/ExpletusSans-SemiBold.ttf");
    logo = loadImage("static/images/icon_green.svg");
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
                map.push(
                    new Hex(
                        data[i].id,
                        data[i].q,
                        data[i].r,
                        resources,
                        data[i].player
                    )
                );
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
    for (let i = 0; i < button_names.length; i++) {
        buttons[i] = new Button(
            button_names[i],
            i,
            button_colors[i],
            0.11 * width - 100,
            0.1 * height * (i + 2),
            (sx = 0.1 * width),
            (sy = 0.07 * height)
        );
    }
    validate = new Button(
        "Choose this location",
        7,
        24,
        0.8 * width,
        0.93 * height - 0.02 * width,
        (sx = 0.18 * width),
        (sy = 0.07 * height)
    );
    newdraw();
}

function draw() {
    for (let i = 0; i < buttons.length; i++) {
        if (buttons[i].is_clicked()) {
            buttons[i].display_button((hover = true));
        } else {
            buttons[i].display_button();
        }
    }
    if (selected_id != null) {
        if (map[selected_id].owner) {
            return;
        }
        if (validate.is_clicked()) {
            validate.display_button((hover = true));
        } else {
            validate.display_button();
        }
    }
}

function newdraw() {
    if (width < 1200) {
        newdraw_smartphone();
    } else {
        newdraw_monitor();
    }
}

function newdraw_monitor() {
    s = width / size_param / 7;
    h = 2 * s;
    w = sqrt(3) * s;
    background(104, 45, 55);
    push();
    fill(color(83, 35, 75));
    noStroke();
    rect(0, 0, 390, 100);
    image(logo, 25, 10, 82, 80);
    textFont(font_logo, 50);
    fill(color(131, 52, 33));
    text("Energetica", 230, 40);
    pop();
    push();
    translate(0.5 * width, 0.53 * height);
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
    if (selected_id != null) {
        let h = map[selected_id];
        let tx = w * h.q + 0.5 * w * h.r;
        let ty = 1.5 * s * h.r;
        push();
        translate(tx, ty);
        h.display_tile();
        pop();
    }
    pop();
    push();
    mw = 0.22 * width;
    translate(width - mw, 0);
    noStroke();
    fill(color(83, 35, 75));
    rect(0, 0, mw, height);
    fill(0);
    if (selected_id == null) {
        textSize(width / 50);
        text("INFO", 0.5 * mw, 20);
        textSize(width / 80);
        text(
            "Please choose an available location on the map. The menu on the left allows you to see where different natural resources are located on the map. The location choice is DEFINITIVE, you will not be able to change it during the game.",
            20,
            50,
            mw - 40,
            300
        );
        text(
            "If you need help, click on the book icon next to to title.",
            20,
            300,
            mw - 40,
            200
        );
    } else {
        textSize(width / 50);
        text("RESOURCES", 0.5 * mw, 20);
        for (let i = 0; i < buttons.length; i++) {
            textAlign(LEFT);
            fill(0);
            textSize(width / 80);
            text(buttons[i].name, 20, height / 10 + (height / 10) * i);
            if (i > 2) {
                textAlign(RIGHT);
                textSize(width / 115);
                text(
                    convert_kg_long(
                        map[selected_id].ressources[i],
                        buttons[i].name
                    ),
                    mw - 20,
                    height / 9.5 + (height / 10) * i
                );
            }
            fill(255);
            rect(20, height / 8.2 + (height / 10) * i, mw - 40, height / 20);
            let amount =
                (map[selected_id].ressources[i] * (mw - 40)) / max_q[i];
            fill(color(button_colors[i], 95, 95));
            rect(20, height / 8.2 + (height / 10) * i, amount, height / 20);
        }
        textAlign(RIGHT);
        textSize(width / 115);
        fill(0);
        text(
            round(map[selected_id].ressources[0] * 1000) + " W/m² irradiation",
            mw - 20,
            height / 9.5
        );
        text(
            round(pow(map[selected_id].ressources[1], 0.5) * 50) +
                " km/h windspeed",
            mw - 20,
            height / 9.5 + 0.1 * height
        );
        text(
            map[selected_id].ressources[2] + " suitable locations",
            mw - 20,
            height / 9.5 + 0.2 * height
        );
        textAlign(CENTER);
        if (map[selected_id].owner) {
            textSize(width / 80);
            fill(0, 99, 66);
            text(
                "This tile is already occupied by " +
                    map[selected_id].owner +
                    " !",
                0.5 * mw,
                0.92 * height
            );
        } else {
            validate.display_button();
        }
    }
    pop();
    // display buttons :
    for (let i = 0; i < buttons.length; i++) {
        buttons[i].display_button();
    }
}

function newdraw_smartphone() {
    s = width / size_param / 4;
    h = 2 * s;
    w = sqrt(3) * s;
    for (let i = 0; i < button_names.length; i++) {
        buttons[i].change_values(
            width * ((i % 4) * 0.25 + 0.04 + 0.125 * floor(i / 4)),
            (height - width) * (0.15 + 0.12 * floor(i / 4)),
            width / 5,
            0.09 * (height - width)
        );
    }
    validate.change_values(
        width * 0.15,
        height - 0.12 * (height - width),
        width * 0.7,
        0.09 * (height - width)
    );
    background(104, 45, 55);
    push();
    fill(color(83, 35, 75));
    noStroke();
    rect(0, 0, 80, 80, 0, 0, 25, 0);
    image(logo, 4, 5, 72, 70);
    pop();
    push();
    translate(0.5 * width, 0.2 * width + 0.3 * height);
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
    if (selected_id != null) {
        let h = map[selected_id];
        let tx = w * h.q + 0.5 * w * h.r;
        let ty = 1.5 * s * h.r;
        push();
        translate(tx, ty);
        h.display_tile();
        pop();
    }
    pop();
    push();
    mh = 0.75 * (height - width);
    translate(0, height - mh);
    noStroke();
    fill(color(83, 35, 75));
    rect(0, 0, width, mh);
    fill(0);
    if (selected_id == null) {
        textSize(width / 17);
        text("INFO", 0.5 * width, 15);
        textSize(width / 25);
        text(
            "Please choose an available location on the map. The menu on the left allows you to see where different natural resources are located on the map. The location choice is DEFINITIVE, you will not be able to change it during the game.",
            15,
            40,
            width - 15,
            200
        );
        text(
            "If you need help, click on the book icon next to to title.",
            15,
            200,
            width - 15,
            200
        );
    } else {
        textSize(width / 16);
        text("RESOURCES", 0.5 * width, 15);
        for (let i = 0; i < buttons.length; i++) {
            textAlign(RIGHT);
            fill(0);
            textSize(width / 20);
            text(buttons[i].name, 0.22 * width, mh / 7 + (mh / 10) * i);
            if (i > 2) {
                textSize(width / 35);
                text(
                    convert_kg_long(
                        map[selected_id].ressources[i],
                        buttons[i].name
                    ),
                    width - 15,
                    mh / 7.5 + (mh / 10) * i
                );
            }
            fill(255);
            rect(
                0.25 * width,
                mh / 6 + (mh / 10) * i,
                0.75 * width - 15,
                mh / 75
            );
            let amount =
                (map[selected_id].ressources[i] * (0.75 * width - 15)) /
                max_q[i];
            fill(color(button_colors[i], 95, 95));
            rect(0.25 * width, mh / 6 + (mh / 10) * i, amount, mh / 75);
        }
        textAlign(RIGHT);
        textSize(width / 35);
        fill(0);
        text(
            round(map[selected_id].ressources[0] * 1000) + " W/m² irradiation",
            width - 15,
            mh / 7.5
        );
        text(
            round(pow(map[selected_id].ressources[1], 0.5) * 50) +
                " km/h windspeed",
            width - 15,
            mh / 7.5 + 0.1 * mh
        );
        text(
            map[selected_id].ressources[2] + " suitable locations",
            width - 15,
            mh / 7.5 + 0.2 * mh
        );
        textAlign(CENTER);
        if (map[selected_id].owner) {
            textSize(width / 25);
            fill(0, 99, 66);
            text(
                "This tile is already occupied by " +
                    map[selected_id].owner +
                    " !",
                0.5 * width,
                0.9 * mh
            );
        } else {
            validate.display_button();
        }
    }
    pop();
    // display buttons :
    for (let i = 0; i < buttons.length; i++) {
        buttons[i].display_button();
    }
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
    if (width < 1200) {
        if (touches.length == 0) {
            mousePressed_smartphone();
        }
    } else {
        mousePressed_monitor();
    }
}

function mousePressed_monitor() {
    // button pressed :
    if (
        (mouseX > width / 2 + w * (size_param + 0.5)) |
        (mouseX < width / 2 - w * (size_param + 0.5))
    ) {
        if (validate.is_clicked()) {
            if (selected_id != null) {
                fetch(`/choose_location?selected_id=${selected_id}`, {
                    method: "POST",
                })
                    .then((response) => {
                        response.json().then((raw_data) => {
                            if (raw_data["response"] == "locationOccupied") {
                                addError("This location is already occupied!");
                                setTimeout(function () {
                                    location.reload();
                                }, 1000);
                            } else {
                                // success or choiceUnmodifiable
                                window.location.href = "/home";
                            }
                        });
                    })
                    .catch((error) => {
                        console.error("Error:", error);
                    });
            } else {
                addError("No location has been selected");
            }
        }
        for (let i = 0; i < buttons.length; i++) {
            if (buttons[i].is_clicked()) {
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
                newdraw();
                return;
            }
        }
    }
    // tile pressed :
    else {
        // APPROXIMATIVE WAY OF LOCATING A TILE :
        let r = floor((mouseY - height * 0.53 + 0.75 * s) / (0.75 * h));
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

function mousePressed_smartphone() {
    // button pressed :
    if (
        (mouseY > height - 0.75 * (height - width)) |
        (mouseY < 0.36 * (height - width))
    ) {
        if (validate.is_clicked()) {
            if (selected_id != null) {
                socket.emit("choose_location", selected_id);
            } else {
                addError("No location has been selected!");
            }
        }
        for (let i = 0; i < buttons.length; i++) {
            if (buttons[i].is_clicked()) {
                if (buttons[i].active) {
                    buttons[i].active = false;
                    console.log("desactivating buttion");
                    active_vew = -1;
                } else {
                    if (active_vew >= 0) {
                        buttons[active_vew].active = false;
                    }
                    buttons[i].active = true;
                    console.log("activating buttion");
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
        let r = floor(
            (mouseY - 0.2 * width - 0.3 * height + 0.75 * s) / (0.75 * h)
        );
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
    if (mass == 0) {
        return 0;
    }
    const units = [" kg", " t", " kt", " Mt"];
    return general_convert(mass, units);
}

function convert_kg_long(mass, resource) {
    mass /= 1000;
    return `${mass
        .toFixed(0)
        .replace(
            /\B(?=(\d{3})+(?!\d))/g,
            "'"
        )} tons of ${resource.toLowerCase()} in the ground`;
}

function general_convert(value, units) {
    let unit_index = 0;
    while (value >= 1000 && unit_index < units.length - 1) {
        value /= 1000;
        unit_index += 1;
    }
    return `${value.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, "'")}${
        units[unit_index]
    }`;
}
