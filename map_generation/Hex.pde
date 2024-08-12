class Hex{
  int id;
  int q, r;
  boolean selected;
  //float solar, wind, hydro, coal, oil, gas, uranium, risk, score;
  float[] resources;
  Hex(int _id, int _q, int _r, float[] _resources){
    id = _id;
    q = _q;
    r = _r;
    resources = _resources;
    selected = false;
  }
  void display_tile(){
    if(active_vew>=0){
      fill(color(button_colors[active_vew], resources[active_vew]*255, 255));
    }else{
      fill(color(32, 54, 229));
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
      text(round(resources[active_vew]*100) + "%", 0, 0);
    }else{
      text(id, 0, 0);
      //text(-q-r, 0, 0);
    }
  }
}
