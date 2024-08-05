class Hex{
  int id;
  int q, r;
  boolean selected;
  //float solar, wind, hydro, coal, oil, gas, uranium, total;
  float[] resources = {0, 0, 0, 0, 0, 0, 0, 0};
  Hex(int _id, int _q, int _r){
    id = _id;
    q = _q;
    r = _r;
    resources[0] = 0.8*exp(-sq(this.r*3)/mapsize)+0.2;
    selected = false;
  }
  void display_tile(){
    if(active_vew>=0){
      fill(color(button_colors[active_vew], resources[active_vew]*(255-int(active_vew==7)*155), 255));
    }else{
      fill(color(180));
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
      text(0.01*round(resources[active_vew]*100), 0, 0);
    }else{
      text(id, 0, 0);
      //text(r, 0, 0);
    }
  }
}
