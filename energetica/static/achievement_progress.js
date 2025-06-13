const formatting_mapping = {
  "power_consumption": format_power,
  "energy_storage": format_energy,
  "mineral_extraction": format_mass,
  "network_import": format_energy,
  "network_export": format_energy,
  "trading": format_mass,
  "network": format_power,
};


function refresh_achievements() {
  fetch('/api/get_upcoming_achievements')
    .then((response) => response.json())
    .then((upcoming_achievements) => {
      display_achievement_progress(upcoming_achievements);
    });
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
    <div class="progressbar-name medium txt_center" style="width:60px">+${upcoming_achievement.reward} XP</div>`;
  });
}

setInterval(() => {
  refresh_achievements();
}, 10000);


fetch('/api/v1/daily_quiz')
  .then((response) => response.json())
  .then((quiz_question) => {
    display_quiz_question(quiz_question);
  });

function answer_quiz(answer) {
  send_json("/api/v1/daily_quiz", { player_answer: answer })
    .then((response) => {
      response.json().then((response_data) => {
        if (response_data.answered_correctly) {
          addToast("Correct answer! You earned 1XP");
        } else {
          addError("Incorrect answer! Try again tomorrow.");
        }
        display_quiz_question(response_data);
      });
    });
}

function display_quiz_question(question_data) {
  console.log(question_data);
  const quiz = document.getElementById("quiz_question");
  quiz.innerHTML = `<p>${question_data.question}</p>`;
  if (question_data.player_answer !== null) {
    quiz.innerHTML += `<div class="quiz_answers_container">
    <button class="quiz_answer medium ${question_data.correct_answer == "answer1" || question_data.correct_answer == "all correct" ? "correct" : "incorrect"}" disabled>${question_data.answer1}</button>
    <button class="quiz_answer medium ${question_data.correct_answer == "answer2" || question_data.correct_answer == "all correct" ? "correct" : "incorrect"}" disabled>${question_data.answer2}</button>
    <button class="quiz_answer medium ${question_data.correct_answer == "answer3" || question_data.correct_answer == "all correct" ? "correct" : "incorrect"}" disabled>${question_data.answer3}</button>
    </div>
    <p>${question_data.explanation}</p>
    <p class="txt_center"><a href="${question_data.Link}" target="_blank">Learn more</a></p>`;
  } else {
    quiz.innerHTML += `<div class="quiz_answers_container">
    <button class="quiz_answer medium" onclick="answer_quiz('answer1')">${question_data.answer1}</button>
    <button class="quiz_answer medium" onclick="answer_quiz('answer2')">${question_data.answer2}</button>
    <button class="quiz_answer medium" onclick="answer_quiz('answer3')">${question_data.answer3}</button>
    </div>`;
  }
}