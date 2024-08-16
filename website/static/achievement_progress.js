const formatting_mapping = {
  "power_consumption": format_power,
  "energy_storage": format_energy,
  "mineral_extraction": format_mass,
  "network_import": format_energy,
  "network_export": format_energy,
  "trading": format_mass,
  "network": format_power,
}



function refresh_achievements() {
  fetch('/api/get_upcoming_achievements')
    .then((response) => response.json())
    .then((upcoming_achievements) => {
      display_achievement_progress(upcoming_achievements);
    })
}

function display_achievement_progress(upcoming_achievements) {
  const ua = document.getElementById("achievement_progression");
  ua.innerHTML = "";
  Object.entries(upcoming_achievements).forEach(([key, upcoming_achievement]) => {
    let format = (value) => value;
    if (key in formatting_mapping) {
      format = formatting_mapping[key];
    }
    ua.innerHTML += `<div class="progressbar-container">
    <div class="progressbar-name medium margin-small">${upcoming_achievement.name}</div>
    <div class="progressbar-background">
        <div class="achievement-progression ${upcoming_achievement.status == 0 ? '' : 'pine'}" style="--width:${100 * upcoming_achievement.status / upcoming_achievement.objective}">&nbsp;${format(upcoming_achievement.status)} / ${format(upcoming_achievement.objective)}</div>
    </div>
    <div class="progressbar-name medium margin-small">(+${upcoming_achievement.reward} XP)</div>`
  });
}

setInterval(() => {
  refresh_achievements();
}, 10000);
