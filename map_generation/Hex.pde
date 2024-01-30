class Hex{
  int q, r, s;
  //float solar, wind, hydro, coal, oil, gas, uranium, total;
  float[] resources = {0, 0, 0, 0, 0, 0, 0, 0};
  Hex(int _q, int _r){
    q = _q;
    r = _r;
    s = - q - r;
    resources[0] = 0.8*exp(-sq(r*3.75/mapsize))+0.2;
  }
  void display_tile(){
    if(active_vew>=0){
      hexagon.setFill(color(button_colors[active_vew], resources[active_vew]*(255-int(active_vew==7)*155), 255));
    }else{
      hexagon.setFill(color(180));
    }
    shape(hexagon, 0, 0);
    fill(0);
    if(active_vew>=0){
      text(resources[active_vew], 0, 0);
    }else{
      text(str(q)+", "+r+", "+s, 0, 0);
    }
    
  }
}

void create_hexagon(){
  //creating PShape
  h = 2*size;
  w = sqrt(3)*size;
  hexagon = createShape();
  hexagon.beginShape();
  hexagon.fill(180);
  //hexagon.noStroke();
  hexagon.vertex(0, size);
  hexagon.vertex(0.5*w, 0.5*size);
  hexagon.vertex(0.5*w, -0.5*size);
  hexagon.vertex(0, -size);
  hexagon.vertex(-0.5*w, -0.5*size);
  hexagon.vertex(-0.5*w, 0.5*size);
  hexagon.endShape(CLOSE);
}
