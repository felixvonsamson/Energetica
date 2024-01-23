let data;
get_data();

function get_data() {
    fetch(`/get_scoreboard`) // retrieves array of players with scoreboard data
        .then((response) => response.json())
        .then((raw_data) => {
            data = raw_data;
            sortTable(2);
        })
        .catch((error) => {
            console.error("Error:", error);
        });
}

function sortTable(columnIndex) {
    table = document.getElementById("scoreboard");
    let headers = table.getElementsByTagName("th");
    let triangle = ' <i class="fa fa-caret-down">';

    if (headers[columnIndex].innerHTML.includes(triangle)) {
        data.sort((a, b) => a[columnIndex] - b[columnIndex]);
        triangle = ' <i class="fa fa-caret-up">';
    } else {
        data.sort((a, b) => b[columnIndex] - a[columnIndex]);
    }

    let html = `<tr>
        <th>Usernames</th>
        <th onclick="sortTable(1)">Money </th>
        <th onclick="sortTable(2)">Revenues </th>
        <th onclick="sortTable(3)">CO2 emissions </th>
        </tr>`;
    for (row in data) {
        html += `<tr>
            <td>${data[row][0]}</td>
            <td>${Math.round(data[row][1])}</td>
            <td>${Math.round(data[row][2])}</td>
            <td>${Math.round(data[row][3])}</td>
            </tr>`;
    }
    table.innerHTML = html;
    headers = table.getElementsByTagName("th");
    headers[columnIndex].innerHTML += triangle;
}
