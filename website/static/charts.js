let data = [];
let resolution = [60, 360, 720, 1440];
let buttons = [];

let margin = 50;
let data_len = 1440;
let graph_h, graph_w;
let graph;

class Button{
  constructor(_value){
    this.v = _value
    this.active = false;
  }
  display_button(){
    push();
    if(this.active){
      fill(220);
    }else{
      fill(180);
    }
    rect(0, 0, width/resolution.length, 0.5*margin);
    fill(0);
    textAlign(CENTER, CENTER);
    text(this.v, 0.5*width/resolution.length, 0.25*margin);
    pop();
  }
}

function setup() {
  let canvas = createCanvas(1200, 800);
  canvas.parent("generation graph");
  graph_h = height-2*margin;
  graph_w = width-2*margin;
  data = generate_data();
  
  for (let i = 0; i < resolution.length; i++) {
    buttons[i] = new Button(resolution[i]);
  }
  regen(1440);
}

function draw() {
  image(graph, 0, 0);
  stroke(255);
  strokeWeight(2);
  let X = min(width-margin, max(margin, mouseX));
  let t = floor(map(X, margin, width-margin, data[0].length-data_len, data[0].length));
  if(t == data[0].length){t = data[0].length-1;}
  line(X, margin, X, height-margin);
  push();
  noStroke();
  textAlign(CENTER, CENTER);
  translate(X, height-margin);
  for(i=0; i<data.length; i++){
    ellipse(0, -data[i][t]/maxSum*graph_h,8, 8);
    rect(10, -data[i][t]/maxSum*graph_h, 50, 16);
    text(round(data[i][t], 2),35, -data[i][t]/maxSum*graph_h+8)
    translate(0, -data[i][t]/maxSum*graph_h);
  }
  pop();
  for(let i = 0; i<buttons.length; i++){
    push();
    translate(i*width/buttons.length, height-0.5*margin);
    buttons[i].display_button();
    pop();
  }
}

function generate_data(){
  for(s=0; s<5; s++){
    S = [random(200, 800)];
    for(i=0; i<data_len-1; i++){
      append(S, max(0, S[i]+random(-20,20)));
    }
    append(data, S);
  }
  return data;
}

function mousePressed(){
  if(mouseY>height-0.5*margin){
    let i = floor(mouseX*buttons.length/width);
    if(buttons[i].active){
      buttons[i].active = false;
    }else{
      for(let j = 0; j<buttons.length; j++){
        buttons[j].active = false;
      }
      buttons[i].active = true;
    }
    regen(buttons[i].v);
  }
}

function regen(res){
  data_len = res;
  background(229, 217, 182);
  push();
  translate(margin, height-margin);
  line(0, 0, graph_w, 0);
  line(0, 0, 0, -graph_h);
  noStroke();
  maxSum = 0;
  for(let t = data_len; t > 0; t--){
    let sumAtIndex = data.reduce((acc, sublist) => acc + sublist[data[0].length-t], 0);
    if (sumAtIndex > maxSum) {
      maxSum = sumAtIndex;
    }
  }
  for(let t = data_len; t > 0; t--){
    push()
    for(i=0; i<data.length; i++){
      fill(255/data.length*i)
      rect(0, 0, graph_w/data_len+1, -data[i][data[0].length-t]/maxSum*graph_h);
      
      translate(0, -data[i][data[0].length-t]/maxSum*graph_h);
    }
    pop();
    translate(graph_w/data_len, 0);
  }
  pop();
  graph = get();
}
