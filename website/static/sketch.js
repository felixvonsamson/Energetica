class Hex{
    constructor(_q, _r){
      this.q = _q;
      this.r = _r;
      this.s = - this.q - this.r;
      this.selected = false;
      this.ressources = [];
      this.ressources[0] = 0.8*exp(-sq(this.r*3.75/mapsize))+0.2;
      for(let i = 1; i<8; i++){
        this.ressources[i] = 0;
      }
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
      vertex(0, size);
      vertex(0.5*w, 0.5*size);
      vertex(0.5*w, -0.5*size);
      vertex(0, -size);
      vertex(-0.5*w, -0.5*size);
      vertex(-0.5*w, 0.5*size);
      endShape(CLOSE);
      fill(0);
      if(active_vew>=0){
        text(round(this.ressources[active_vew],2), 0, 0);
      }else{
        text(str(this.q)+" "+this.r, 0, -5);
        text(this.s, 0, 10)
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
      rect(0, 0, width/8.0, 2*size);
      fill(0);
      text(this.name, width/16.0, size);
      pop();
    }
  }
  
  //PShape hexagon;
  let h, w;
  let size = 20;
  let mapsize = 21;
  let map = [];
  let buttons = [];
  let button_colors = [59, 186, 239, 0, 320, 275, 109, 28];
  let directions = [];
  let active_vew = -1;
  let selected_position = null;
  
  function setup(){
    createCanvas(800,800);
    background(255);
    textAlign(CENTER, CENTER);
    colorMode(HSB);
    //noLoop();
    
    directions = [createVector(1, 0), createVector(0, 1), createVector(-1, 1), createVector(-1, 0), createVector(0, -1), createVector(1, -1)];
    
    let button_names = ["solar", "wind", "hydro", "coal", "oil", "gas", "uranium", "total"];
    for(let i = 0; i<button_names.length; i++){
      buttons[i] = new Button(button_names[i], i, button_colors[i]);
    }
    
    h = 2*size;
    w = sqrt(3)*size;
    
    //filling map
    for(let i = 0; i<mapsize; i++){
      map[i] = [];
      for(let j = 0; j<mapsize; j++){
        if(i+j < mapsize*0.5-1 | i+j > mapsize*1.5-1){
          map[i][j] = null;
        }else{
          map[i][j] = new Hex(i-floor(mapsize*0.5), j-floor(mapsize*0.5));
        }
      }
    }
    
    generate_hydro();
    generate_coal();
    generate_oil_gas();
    generate_uranium();
    generate_wind();
    newdraw();
  }
  
  function draw(){
  }
  
  function newdraw(){
    let bars = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    background(255);
    push();
    translate(0.5*width, 0.5*(height-2*size));
    for(let i = 0; i<mapsize; i++){
      for(let j = 0; j<mapsize; j++){
        let h = map[i][j];
        if(h != null){
          if(active_vew >= 0){
            if(active_vew == 7){
              bars[min(10,floor((h.ressources[active_vew]-1)*6))] ++;
            }else{
              bars[floor(h.ressources[active_vew]*10)] ++;
            }
          }
          push();
          let tx = w * h.q + 0.5 * w * h.r;
          let ty = 1.5 * size * h.r;
          translate(tx, ty);
          h.display_tile();
          //text(str(i)+"-"+j,0,-10);
          pop();
        }
      }
    }
    pop();
    if(active_vew >= 0){
      for(let i = 0; i<bars.length; i++){
        push();
        translate(20*i, height-2*size);
        fill(button_colors[active_vew], 100, 100);
        rect(0, -2*bars[i], 20, 2*bars[i]);
        fill(0);
        text(bars[i], 10, -2*bars[i]-10);
        pop();
      }
    }
    if(selected_position != null){
      let h = map[selected_position.x][selected_position.y];
      for(let i = 0; i<buttons.length-1; i++){
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
      translate(i*width/8.0, height-2*size);
      buttons[i].display_button();
      pop();
    }
  }
  
  function mousePressed(){
    if(mouseY>height-2*size){
      let i = floor(mouseX*8/width);
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
      let r = floor((mouseY-width/2+1.75*size)/(0.75*h));
      let q = floor((mouseX-width/2+0.5*w-0.5*w*r)/w)+0.5*(mapsize-1);
      r += 0.5*(mapsize-1);
      if(r>=0 & q>=0 & r<mapsize & q<mapsize){
        let h = map[q][r];
        if(h!=null){
          if(selected_position != null){
            map[selected_position.x][selected_position.y].selected = false;
          }
          if(h.selected == true){
            h.selected = false;
            selected_position = null;
          }else{
            h.selected = true;
            selected_position = createVector(q, r);
          }
        }
      }
    }
    newdraw();
  }