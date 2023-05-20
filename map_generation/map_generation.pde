PShape hexagon;
float h, w;
int size = 50;
int mapsize = 9;
Hex[][] map = new Hex[mapsize][mapsize];

void setup(){
  size(800,800);
  background(255);
  textAlign(CENTER, CENTER);
  
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
}

void draw(){
  translate(0.5*width, 0.5*height);
  for(int i = 0; i<mapsize; i++){
    for(int j = 0; j<mapsize; j++){
      if(map[i][j] != null){
        pushMatrix();
        float tx = w * map[i][j].q + 0.5 * w * map[i][j].r;
        float ty = 1.5 * size * map[i][j].r;
        translate(tx, ty);
        map[i][j].display_tile();
        popMatrix();
      }
    }
  }
}



class Hex{
  int q, r, s;
  Hex(int _q, int _r){
    q = _q;
    r = _r;
    s = - q - r;
  }
  void display_tile(){
    shape(hexagon, 0, 0);
    text(str(q)+", "+r+", "+s, 0, 0);
  }
}
