class Button{
  String name;
  int id;
  color c;
  boolean active;
  Button(String _name, int _id, int hue){
    name = _name;
    id = _id;
    c = color(hue, 255, 255);
    active = false;
  }
  void display_button(){
    pushStyle();
    if(active){
      fill(c);
    }else{
      fill(180);
    }
    rect(0, 0, width/8.0, 2*s);
    fill(0);
    text(name, width/16.0, s);
    popStyle();
  }
  boolean selected(){
    return mouseX>id/8.0*width & mouseX<(id+1)/8.0*width & mouseY>height-2*s;
  }
}
