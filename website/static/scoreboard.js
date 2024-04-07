let data;
let decending = true;
get_data();

function get_data() {
    fetch(`/get_scoreboard`) // retrieves array of players with scoreboard data
        .then((response) => response.json())
        .then((raw_data) => {
            data = raw_data;
            sortTable('average_hourly_revenues');
        })
        .catch((error) => {
            console.error("Error:", error);
        });
}

function sortTable(columnName) {
    const table = document.getElementById("scoreboard");
    let column = document.getElementById(columnName);
    let triangle = ' <i class="fa fa-caret-down"></i>';

    // Check if the column is already sorted, toggle sorting order accordingly
    if (column.innerHTML.includes(triangle)) {
        decending = !decending;
        triangle = ' <i class="fa fa-caret-up"></i>';
    }else{
        decending = true;
    }

    // Sort the data based on the selected column
    const sortedData = Object.entries(data).sort((a, b) => {
        const aValue = a[1][columnName];
        const bValue = b[1][columnName];

        if (typeof aValue === "string" && typeof bValue === "string") {
            return decending ? bValue.localeCompare(aValue) : aValue.localeCompare(bValue);
        } else {
            return decending ? bValue - aValue : aValue - bValue;
        }
    });

    // Rebuild the HTML table
    let html = `<tr>
        <th id="username" onclick="sortTable('username')">Usernames</th>
        <th id="average_hourly_revenues" onclick="sortTable('average_hourly_revenues')">Revenues</th>
        <th id="max_power_consumption" onclick="sortTable('max_power_consumption')">Max power</th>
        <th id="total_technology_levels" onclick="sortTable('total_technology_levels')">Technology</th>
        <th id="xp" onclick="sortTable('xp')">xp</th>
        <th id="co2_emissions" onclick="sortTable('co2_emissions')">Emissions</th>
        </tr>`;
    for (const [id, player] of sortedData) {
        html += `<tr>
            <td><a href="/profile?player_name=${player['username']}">${player['username']}</td>
            <td>${display_money(player['average_hourly_revenues'], write=false)}/h</td>
            <td>${display_W(player['max_power_consumption'], write=false)}</td>
            <td>${player['total_technology_levels']}</td>
            <td>${player['xp']}</td>
            <td>${display_kg(player['co2_emissions'], write=false)}</td>
            </tr>`;
    }
    table.innerHTML = html;

    // Update the sorting indicator
    column = document.getElementById(columnName);
    column.innerHTML += triangle;
}