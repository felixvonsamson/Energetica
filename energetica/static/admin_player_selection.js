document.addEventListener('DOMContentLoaded', function () {
  fetch("/api/v1/players")
    .then(response => response.json())
    .then(data => {
      const select = document.getElementById('admin_player_selection');
      if (!select) return;
      select.innerHTML = ''; // Clear existing options
      data.forEach(player => {
        const option = document.createElement('option');
        option.value = player.id;
        option.textContent = player.username;
        select.appendChild(option);
      });
    })
    .catch(error => {
      console.error('Error fetching player list:', error);
    });
});