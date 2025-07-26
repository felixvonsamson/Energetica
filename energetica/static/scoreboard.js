let scoreboard_data;
let descending = true;
get_data();

function get_data() {
    fetch("/api/v1/scoreboard") // retrieves array of players with scoreboard data
        .then((response) => response.json())
        .then((raw_data) => {
            scoreboard_data = raw_data;
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
        descending = !descending;
        triangle = ' <i class="fa fa-caret-up"></i>';
    } else {
        descending = true;
    }

    // Sort the data based on the selected column
    const sortedData = scoreboard_data.rows.sort((a, b) => {
        const aValue = a[columnName];
        const bValue = b[columnName];

        if (typeof aValue === "string" && typeof bValue === "string") {
            return descending ? bValue.localeCompare(aValue) : aValue.localeCompare(bValue);
        } else {
            return descending ? bValue - aValue : aValue - bValue;
        }
    });

    // Rebuild the HTML table
    let include_co2_emissions = sortedData[0].hasOwnProperty('co2_emissions') && sortedData[0].co2_emissions !== null;
    let html = `<tr>
        <th id="username" onclick="sortTable('username')">Username</th>
        <th id="network_name" onclick="sortTable('network_name')">Network</th>
        <th id="average_hourly_revenues" onclick="sortTable('average_hourly_revenues')">Revenues</th>
        <th id="max_power_consumption" onclick="sortTable('max_power_consumption')">Max power</th>
        <th id="total_technology_levels" onclick="sortTable('total_technology_levels')">Technology</th>
        <th id="xp" onclick="sortTable('xp')">xp</th>`;
    if (include_co2_emissions) {
        html += `<th id="co2_emissions" onclick="sortTable('co2_emissions')">Emissions</th>`;
    }
    html += `</tr>`;
    load_player_id().then((current_player_id) => {
        for (const row of sortedData) {
            if (row.player_id == current_player_id) {
                href = "/profile";
            } else {
                href = `/profile?player_id=${row.player_id}`;
            }
            html += `<tr>
            <td><a href="${href}">${row.username}</a></td>
            <td>${row.network_name === null ? "-" : row.network_name}</td>
            <td>${format_money(row.average_hourly_revenues)}/h</td>
            <td>${format_power(row.max_power_consumption)}</td>
            <td>${row.total_technology_levels}</td>
            <td>${row.xp}</td>`;
            if (include_co2_emissions) {
                console.log(row.co2_emissions);
                if (row.co2_emissions === null) {
                    html += "<td>?</td>";
                } else {
                    html += `<td>${format_mass(row.co2_emissions)}</td>`;
                }
            }
            html += `</tr > `;
        }
        table.innerHTML = html;

        // Update the sorting indicator
        column = document.getElementById(columnName);
        column.innerHTML += triangle;
    });
};