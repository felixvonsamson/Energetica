const weather_conditions = document.getElementById('current_weather_conditions');
update_weather_conditions();

function update_weather_conditions() {
    fetch("/api/v1/weather")
        .then((response) => response.json())
        .then((weather_data) => {
            const month_name = [
                "January",
                "February",
                "March",
                "April",
                "May",
                "June",
                "July",
                "August",
                "September",
                "October",
                "November",
                "December",
            ][weather_data.month_number - 1];
            weather_conditions.innerHTML = `
        <div class="flex-col flex-grow-1 padding weather_info_container">
            <div>Month: <b>${month_name}</b></div>
            <div class="year-background margin-small">
                <div class="current-date-dot" style="left: calc(${weather_data.year_progress} * 100%);"></div>
            </div>
        </div>
        <div class="flex-col flex-grow-1 padding weather_info_container">
            <div>Irradiance: <b>${Math.round(weather_data.solar_irradiance)} W/m²</b></div>
            <div class="year-background margin-small">

                <div class="weather_level solar" style="width: calc(${weather_data.solar_irradiance / 1000} * 100%);"></div>
            </div>
        </div>
        <div class="flex-col flex-grow-1 padding weather_info_container">
            <div>Wind speed: <b>${Math.round(weather_data.wind_speed)} km/h</b></div>
            <div class="year-background margin-small">
                <div class="weather_level wind" style="width: calc(${weather_data.wind_speed / 60} * 100%);"></div>
            </div>
        </div>
        <div class="flex-col flex-grow-1 padding weather_info_container">
            <div>River discharge: <b>${Math.round(weather_data.river_discharge)} m³/s</b></div>
            <div class="year-background margin-small">
                <div class="weather_level water" style="width: calc(${weather_data.river_discharge / 150} * 100%);"></div>
            </div>
        </div>`;
        })
        .catch((error) => {
            console.error("Error:", error);
        });
}