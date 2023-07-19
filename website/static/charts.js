const labels = [];
const start = new Date();
start.setHours(2, 0, 0, 0); // set start time to midnight
for (let i = 0; i < 1440; i++) {
  const date = new Date(start.getTime() + i * 60000); // create new date object for each minute
  const label = date.toISOString().substr(11, 5); // convert to datetime format
  labels.push(label);
}

var ctx = document.getElementById("prod_chart");
var data = JSON.parse(ctx.dataset.name);

new Chart(ctx, {
  type: "line",
  data: {
    labels: labels,
    datasets: [
      {
        label: "Fossil",
        data: data,
        borderColor: "rgb(224, 52, 101)",
        tension: 0.1,
      },
    ],
  },
  options: {
    elements: {
      point: {
        radius: 0,
      },
    },
  },
});

ctx = document.getElementById("demand_chart");
data = JSON.parse(ctx.dataset.name);

new Chart(ctx, {
  type: "line",
  data: {
    labels: labels,
    datasets: [
      {
        label: "Industry demand",
        data: data,
        borderColor: "rgb(75, 192, 192)",
        tension: 0.1,
      },
    ],
  },
  options: {
    elements: {
      point: {
        radius: 0,
      },
    },
  },
});
