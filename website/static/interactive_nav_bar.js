/* 
This code marks the current page in green in the navigation bar on the left.
*/

const activePage = window.location.pathname;
const navLinks = document.querySelectorAll("nav a").forEach((link) => {
    if (link.href.includes(`${activePage}`)) {
        link.classList.add("active");
        link.querySelector("img").classList.add("active");
        if (link.href.includes("facilities")) {
            expand_menu("facilities");
        } else if (link.href.includes("overview")) {
            expand_menu("overview");
        } else if (
            link.href.includes("scoreboard") ||
            link.href.includes("map") ||
            link.href.includes("network")
        ) {
            expand_menu("community");
        }
    }
});

function expand_menu(id) {
    let dropdown = document.getElementById("menu-" + id);
    let dropdown_icon = document.getElementById("dropdown-" + id);
    dropdown.classList.toggle("show");
    dropdown_icon.classList.toggle("rotate");
}
