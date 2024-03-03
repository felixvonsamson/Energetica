function show_construction(name) {
    let tile = document.getElementById(name);
    let additionalContent = tile.querySelector("#constructionContent");
    let additionalContent_smartphone = tile.querySelector("#constructionContent_smartphone");
    let infotable = tile.querySelector("#infotable");
    let overlay = tile.querySelector('.overlay');
    let button = tile.querySelector('.construction_button_container');

    if (additionalContent.classList.contains("hidden")) {
        additionalContent.classList.remove("hidden");
        additionalContent.classList.add("shown");

        additionalContent_smartphone.classList.remove("hidden");
        additionalContent_smartphone.classList.add("shown");

        infotable.classList.remove("minimized");
        infotable.classList.add("maximized");

        overlay.classList.add('hidden');
        button.classList.remove('hidden');
    } else {
        additionalContent.classList.remove("shown");
        additionalContent.classList.add("hidden");

        additionalContent_smartphone.classList.remove("shown");
        additionalContent_smartphone.classList.add("hidden");

        infotable.classList.remove("maximized");
        infotable.classList.add("minimized");

        overlay.classList.remove('hidden');
        button.classList.add('hidden');
    }
}
