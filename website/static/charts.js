var ctx = document.getElementById('prod_chart');
var data = JSON.parse(ctx.dataset.name);
var labels = Array.from({length: 1440}, (_, i) => i);

  new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Fossil',
        data: data,
        borderColor: 'rgb(224, 52, 101)',
        tension: 0.1
      }]
    },
    options: {
      elements: {
        point:{
          radius: 0
        }
      }
    }
  });

ctx = document.getElementById('demand_chart');
data = JSON.parse(ctx.dataset.name);
labels = Array.from({length: 1440}, (_, i) => i);

  new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Industry demand',
        data: data,
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1
      }]
    },
    options: {
      elements: {
        point:{
          radius: 0
        }
      }
    }
  });