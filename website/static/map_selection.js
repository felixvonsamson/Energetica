var socket = io();

class Hex{
    constructor(_id, _q, _r, _ressources){
      this.id = _id;
      this.q = _q;
      this.r = _r;
      this.s = - this.q - this.r;
      this.selected = false;
      this.ressources = _ressources;
    }
    display_tile(){
      if(active_vew>=0){
        fill(color(button_colors[active_vew], this.ressources[active_vew]*(100-int(active_vew==7)*67), 100));
      }else{
        fill(color(180));
      }
      if(this.selected == true){
        stroke(5);
      }
      beginShape();
      vertex(0, s);
      vertex(0.5*w, 0.5*s);
      vertex(0.5*w, -0.5*s);
      vertex(0, -s);
      vertex(-0.5*w, -0.5*s);
      vertex(-0.5*w, 0.5*s);
      endShape(CLOSE);
      fill(0);
      if(active_vew>=0){
        text(round(this.ressources[active_vew],2), 0, 0);
      }else{
        text(str(this.q)+" "+this.r, 0, -5);
        text(this.s, 0, 10);
        //text(this.id, 0, 0);
      }
    }
  }
  
  class Button{
    constructor(_name, _id, hue){
      this.name = _name;
      this.id = _id;
      this.c = color(hue, 255, 255);
      this.active = false;
    }
    display_button(){
      push();
      if(this.active){
        fill(this.c);
      }else{
        fill(180);
      }
      rect(0, 0, width/8.0, 2*s);
      fill(0);
      text(this.name, width/16.0, s);
      pop();
    }
  }
  
  //PShape hexagon;
  let h, w;
  let size_param = 10; //indicates the size of the map
  let s = 0.25*800/size_param; //displayed size of the hexagon tiles
  let mapsize = size_param*(size_param+1)*3+1; //lenght of the list that contains the hexagon tiles
  let map = [];
  let map_data;
  let buttons = [];
  let validate;
  let button_colors = [59, 186, 239, 0, 320, 275, 109];
  let directions = [];
  let active_vew = -1;
  let selected_id = null;
  
  function preload() {
    //filling map
    fetch('/get_map')
    .then(response => response.json())
    .then(data => {
      for (let i = 0; i < data.length; i++) {
        let resources = [data[i].solar, data[i].wind, data[i].hydro, data[i].coal, data[i].gas, data[i].oil, data[i].uranium];
        map.push(new Hex(data[i].id, data[i].q, data[i].r, resources));
      }
      newdraw();
    })
    .catch(error => {
      console.log(error);
      console.error('Error:', error);
    });
  }

  function setup(){
    createCanvas(800,800);
    background(255);
    textAlign(CENTER, CENTER);
    colorMode(HSB);
    
    let button_names = ["solar", "wind", "hydro", "coal", "oil", "gas", "uranium"];
    for(let i = 0; i<button_names.length; i++){
      buttons[i] = new Button(button_names[i], i, button_colors[i]);
    }
    validate = new Button("VALIDATE", 7, 24);
    
    h = 2*s;
    w = sqrt(3)*s;
  }
  
  function draw(){
  }
  
  function newdraw(){
    let bars = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    background(255);
    push();
    translate(0.5*width, 0.5*(height-2*s));
    for(let i = 0; i<map.length; i++){
      let h = map[i];
      if(active_vew >= 0){
        bars[floor(h.ressources[active_vew]*10)] ++;
      }
      push();
      let tx = w * h.q + 0.5 * w * h.r;
      let ty = 1.5 * s * h.r;
      translate(tx, ty);
      h.display_tile();
      //text(str(i)+"-"+j,0,-10);
      pop();
    }
    pop();
    if(active_vew >= 0){
      for(let i = 0; i<bars.length; i++){
        push();
        translate(20*i, height-2*s);
        fill(button_colors[active_vew], 100, 100);
        rect(0, -2*bars[i], 20, 2*bars[i]);
        fill(0);
        text(bars[i], 10, -2*bars[i]-10);
        pop();
      }
    }
    if(selected_id != null){
      let h = map[selected_id];
      for(let i = 0; i<buttons.length; i++){
        push();
        translate(0, 20*i);
        fill(button_colors[i], 100, 100);
        rect(0, 0, h.ressources[i]*100, 20);
        fill(0);
        text(round(h.ressources[i],2), h.ressources[i]*100+15, 10);
        pop();
      }
    }
    for(let i = 0; i<buttons.length; i++){
      push();
      translate(i*width/8.0, height-2*s);
      buttons[i].display_button();
      pop();
    }
    translate(7*width/8.0, height-2*s);
    validate.display_button();
  }
  
  function mousePressed(){
    if(mouseY>height-2*s){
      let i = floor(mouseX*8/width);
      if(i==7){
        if(selected_id != null){
          socket.emit('choose_location', selected_id);
        }
        return;
      }
      if(buttons[i].active){
        buttons[i].active = false;
        active_vew = -1;
      }else{
        if(active_vew>=0){
          buttons[active_vew].active = false;
        }
        buttons[i].active = true;
        active_vew = buttons[i].id;
      }
    }else{
      let id = 1;
      let r = floor((mouseY-width/2+1.75*s)/(0.75*h));
      let q = floor((mouseX-width/2+0.5*w-0.5*w*r)/w)+0.5*(21-1);
      r += 0.5*(21-1);
      if(r>=0 & q>=0 & r<21 & q<21){
        let h = map[id];
        if(h!=null){
          if(selected_id != null){
            map[selected_id].selected = false;
          }
          if(h.selected == true){
            h.selected = false;
            selected_id = null;
          }else{
            h.selected = true;
            selected_id = id;
          }
        }
      }
    }
    newdraw();
  }