float h, w;
int size_param = 10; //indicates the size of the map
float s = 0.25*800/size_param; //displayed size of the hexagon tiles
int mapsize = size_param*(size_param+1)*3+1; //lenght of the list that contains the hexagon tiles
Hex[] map = new Hex[mapsize];
Button[] buttons = new Button[8];
int[] button_colors = {42, 132, 169, 0, 227, 195, 77, 20};
PVector[] directions = {new PVector(1, 0), new PVector(0, 1), new PVector(-1, 1), new PVector(-1, 0), new PVector(0, -1), new PVector(1, -1)};
int active_vew = -1;
int selected_id = 0;

PVector id_to_coords(int n){
  if (n == 0) {
    return new PVector(0, 0);
  }
  int L = 1 + int(floor((sqrt(12 * n - 3) - 3) / 6));
  n -= 1 + 3 * L * (L - 1);
  int S = int(floor(n / L));
  int R = n % L + 1;
  
  int x = sgn(S + 2) * L + sgn(S + 4) * R;
  int y = sgn(S) * L + sgn(S + 2) * R;
  return new PVector(x, y);
}

int coords_to_id(int q, int r){
  if(q == 0 && r == 0){
    return 0;
  }
  float L = 0.5*(abs(q)+abs(r)+abs(q+r));
  int n = int(3 * L * (L-1));
  if(q == L){
    return n + 6*int(L) + r;
  }
  if(q+r == L){
    return n + r;
  }
  if(r == L){
    return n + int(L) - q;
  }
  if(q == -L){
    return n + 3*int(L) - r;
  }
  if(q+r == -L){
    return n + 3*int(L) - r;
  }
  return n + 4*int(L) + q;
}

int sgn(int i){
  int[] sgnArr = {0, 1, 1, 0, -1, -1};
  return sgnArr[i % 6];
}


void setup(){
  size(800,800);
  background(255);
  textAlign(CENTER, CENTER);
  colorMode(HSB);
  //noLoop();
  
  String[] button_names = {"solar", "wind", "hydro", "coal", "oil", "gas", "uranium", "total"};
  for(int i = 0; i<buttons.length; i++){
    buttons[i] = new Button(button_names[i], i, button_colors[i]);
  }
  
  h = 2*s;
  w = sqrt(3)*s;
  
  //filling map
  for(int i = 0; i<mapsize; i++){
    PVector coords = id_to_coords(i);
    map[i] = new Hex(i, int(coords.x), int(coords.y));
  }
  
  generate_hydro();
  generate_coal();
  generate_oil_gas();
  generate_uranium();
  generate_background_resources();
  generate_wind();
  redraw();
}

void draw(){
}

void redraw(){
  int[] bars = {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0};
  background(255);
  pushMatrix();
  translate(0.5*width, 0.5*(height-2*s));
  for(int i = 0; i<map.length; i++){
    Hex h = map[i];
    if(active_vew >= 0){
      if(active_vew == 7){
        bars[min(10,floor((h.resources[active_vew]-1)*6))] ++;
      }else{
        bars[floor(h.resources[active_vew]*10)] ++;
      }
    }
    pushMatrix();
    float tx = w * h.q + 0.5 * w * h.r;
    float ty = 1.5 * s * h.r;
    translate(tx, ty);
    h.display_tile();
    //text(str(i)+"-"+j,0,-10);
    popMatrix();
  }
  Hex h = map[selected_id];
  pushMatrix();
  pushStyle();
  float tx = w * h.q + 0.5 * w * h.r;
  float ty = 1.5 * s * h.r;
  translate(tx, ty);
  strokeWeight(5);
  h.display_tile();
  popStyle();
  popMatrix();
  popMatrix();
  if(active_vew >= 0){
    for(int i = 0; i<bars.length; i++){
      pushMatrix();
      translate(20*i, height-2*s);
      fill(button_colors[active_vew], 255, 255);
      rect(0, -4*bars[i], 20, 4*bars[i]);
      fill(0);
      text(bars[i], 10, -4*bars[i]-10);
      popMatrix();
    }
  }
  if(selected_id != 0){
    Hex selected_h = map[selected_id];
    for(int i = 0; i<buttons.length-1; i++){
      push();
      translate(0, 20*i);
      fill(button_colors[i], 255, 255);
      rect(0, 0, selected_h.resources[i]*100, 20);
      fill(0);
      text(0.01*round(selected_h.resources[i]*100), selected_h.resources[i]*100+15, 10);
      pop();
    }
  }
  for(int i = 0; i<buttons.length; i++){
    pushMatrix();
    translate(i*width/8.0, height-2*s);
    buttons[i].display_button();
    popMatrix();
  }
}

void mousePressed() {
  if (mouseY > height - 2*s) {
    int i = floor(mouseX * 8 / width);
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
  } else {
    int r = floor((mouseY - width/2 + 1.75 * s) / (0.75 * h));
    int q = floor((mouseX - width/2 + 0.5 * w - 0.5 * w * r) / w);
    int id = coords_to_id(q, r);
    if (id < map.length) {
      Hex h = map[id];
      if (selected_id != 0) {
        map[selected_id].selected = false;
      }
      if (h.selected == true) {
        h.selected = false;
        selected_id = 0;
      } else {
        h.selected = true;
        selected_id = id;
      }
    }
  }
  redraw();
}

void keyPressed(){
  if(key == 's'){
    generate_table();
  }
  if(key == 'r'){
    for(int i = 0; i<mapsize; i++){
      for(int j = 1; j< map[i].resources.length; j++){
        map[i].resources[j] = 0;
      }
    }
    generate_hydro();
    generate_coal();
    generate_oil_gas();
    generate_uranium();
    generate_background_resources();
    generate_wind();
    redraw();
  }
}
