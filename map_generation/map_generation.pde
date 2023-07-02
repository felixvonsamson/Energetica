PShape hexagon;
float h, w;
int size = 30;
int mapsize = 21;
Hex[][] map = new Hex[mapsize][mapsize];
Button[] buttons = new Button[8];
int[] button_colors = {42, 132, 169, 0, 227, 195, 77, 20};
PVector[] directions = {new PVector(1, 0), new PVector(0, 1), new PVector(-1, 1), new PVector(-1, 0), new PVector(0, -1), new PVector(1, -1)};
int active_vew = -1;

void setup(){
  size(1200,1200);
  background(255);
  textAlign(CENTER, CENTER);
  colorMode(HSB);
  //noLoop();
  
  String[] button_names = {"solar", "wind", "hydro", "coal", "oil", "gas", "uranium", "total"};
  for(int i = 0; i<buttons.length; i++){
    buttons[i] = new Button(button_names[i], i, button_colors[i]);
  }
  
  create_hexagon();
  
  //filling map
  for(int i = 0; i<mapsize; i++){
    for(int j = 0; j<mapsize; j++){
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
  redraw();
}

void draw(){
}

void redraw(){
  int[] bars = {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0};
  background(255);
  pushMatrix();
  translate(0.5*width, 0.5*(height-2*size));
  for(int i = 0; i<mapsize; i++){
    for(int j = 0; j<mapsize; j++){
      Hex h = map[i][j];
      if(h != null){
        if(active_vew >= 0){
          if(active_vew == 7){
            bars[min(10,floor((h.ressources[active_vew]-1)*6))] ++;
          }else{
            bars[floor(h.ressources[active_vew]*10)] ++;
          }
        }
        pushMatrix();
        float tx = w * h.q + 0.5 * w * h.r;
        float ty = 1.5 * size * h.r;
        translate(tx, ty);
        h.display_tile();
        //text(str(i)+"-"+j,0,-10);
        popMatrix();
      }
    }
  }
  popMatrix();
  if(active_vew >= 0){
    for(int i = 0; i<bars.length; i++){
      pushMatrix();
      translate(20*i, height-2*size);
      fill(button_colors[active_vew], 255, 255);
      rect(0, -4*bars[i], 20, 4*bars[i]);
      fill(0);
      text(bars[i], 10, -4*bars[i]-10);
      popMatrix();
    }
  }
  for(int i = 0; i<buttons.length; i++){
    pushMatrix();
    translate(i*width/8.0, height-2*size);
    buttons[i].display_button();
    popMatrix();
  }
}

void mousePressed(){
  for(int i = 0; i<buttons.length; i++){
    if(buttons[i].selected()){
      if(buttons[i].active){
        buttons[i].active = false;
        active_vew = -1;
        break;
      }else{
        if(active_vew>=0){
          buttons[active_vew].active = false;
        }
        buttons[i].active = true;
        active_vew = buttons[i].id;
        break;
      }
    }
  }
  redraw();
}
