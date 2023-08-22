/* 
This code creates a list of suggestions when typing names in a field
*/

let sortedNames

fetch("/get_usernames") // retrieves list of all names using api.py
  .then((response) => response.json())
  .then((data) => {
    sortedNames = data.sort();
  })
  .catch((error) => {
    console.log(error);
    console.error("Error:", error);
  });

let input = document.getElementById("add_chat_username");

input.addEventListener("keyup", (e) => {
  //Initially remove all elements (so if user erases a letter or adds new letter then clean previous outputs)
  removeElements();
  for (let i of sortedNames) {
    //convert input to lowercase and compare with each string
    if (
      i.toLowerCase().startsWith(input.value.toLowerCase())) {
      let listItem = document.createElement("li");
      listItem.classList.add("suggestions-items", "white", "medium");
      listItem.style.cursor = "pointer";
      listItem.setAttribute("onclick", "displayNames('" + i + "')");
      //Display matched part in bold
      let word = "<b>" + i.substr(0, input.value.length) + "</b>";
      word += i.substr(input.value.length);
      //display the value in array
      listItem.innerHTML = word;
      document.querySelector(".suggestions").appendChild(listItem);
    }
  }
});
function displayNames(value) {
  input.value = value;
  removeElements();
}
function removeElements() {
  //clear all the item
  let items = document.querySelectorAll(".suggestions-items");
  items.forEach((item) => {
    item.remove();
  });
}