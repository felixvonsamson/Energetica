let active_facilities;
let decending = true;

if (window.location.href.includes("player_id")){
  let profile_headder = document.getElementById("profile_headder");
  profile_headder.classList.add("hidden");
}
get_active_facilities();

function get_active_facilities() {
    fetch("/api/get_active_facilities") // retrieves all active facilities of the player
        .then((response) => response.json())
        .then((raw_data) => {
          console.log(raw_data);
            active_facilities = raw_data;
            sortTable('installed_cap');
        })
        .catch((error) => {
            console.error("Error:", error);
        });
}

function sortTable(columnName) {
    const table = document.getElementById("power_facilities_table");
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
    const sortedData = Object.entries(active_facilities.power_facilities).sort((a, b) => {
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
        <th id="facility" onclick="sortTable('facility')">Facility</th>
        <th id="installed_cap" onclick="sortTable('installed_cap')">Max power</th>
        <th id="op_cost" onclick="sortTable('op_cost')">O&M costs</th>
        <th id="remaining_lifespan" onclick="sortTable('remaining_lifespan')">Lifespan left</th>
        <th id="upgrade">Upgrade</th>
        <th id="dismantle">Dismantle</th>
        </tr>`;
    load_const_config().then((const_config) => {
      for (const [id, facility] of sortedData) {
        console.log(facility);
        html += `<tr>
            <td>${const_config.assets[facility['facility']].name}</td>
            <td>${display_W(const_config.assets[facility['facility']].base_power_generation * facility.power_multiplier, write=false)}</td>
            <td>${display_money(facility['op_cost'], write=false)}/h</td>
            <td>${display_days(facility['end_of_life'], write=false)}</td>
            <td>Upgrade</td>
            <td>Dismantle</td>
            </tr>`;
      }
      table.innerHTML = html;
    });
    
    // Update the sorting indicator
    column = document.getElementById(columnName);
    column.innerHTML += triangle;
}