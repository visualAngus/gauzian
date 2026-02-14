<template>
  <div class="parent-section">
    <div class="mini-titre">
      <h2 id="mini-titre__moi">{{ monthLabel }}</h2>
      <div class="mini-titre__btns">
        <button
          class="mini-titre__btns--prev"
          title="Mois précédent"
          @click="goToPrevMonth"
        >
          <
        </button>
        <button
          class="mini-titre__btns--next"
          title="Mois suivant"
          @click="goToNextMonth"
        >
          >
        </button>
      </div>
    </div>
    <div class="days-section">
      <div class="days-section--names">
        <div>L</div>
        <div>M</div>
        <div>M</div>
        <div>J</div>
        <div>V</div>
        <div>S</div>
        <div>D</div>
      </div>
      <div class="days-grid">
        <div
          v-for="(item, index) in days"
          :key="index"
          class="day"
          :class="{
            'other-month': !item.currentMonth,
            today: item.today,
            'current-week': item.currentWeek === currentWeek,
            'the-first-day-of-the-week': item.isTheFirstDayOfTheWeek,
            'the-last-day-of-the-week': item.isTheLastDayOfTheWeek,
          }"
        >
          {{ item.day }}
        </div>
      </div>
    </div>
  </div>
</template>
<script setup>
import { computed, ref } from "vue";

// recupérer les jours du mois et les afficher dans la section days-section
// les jours doivent être affichés dans la bonne case en fonction du jour de la semaine du 1er jour du mois
// les jours doivent être affichés dans l'ordre croissant
// les jours doivent être affichés dans une grille de 7 colonnes et 7 lignes

const map = {
  0: 7, // dimanche
  1: 1, // lundi
  2: 2, // mardi
  3: 3, // mercredi
  4: 4, // jeudi
  5: 5, // vendredi
  6: 6, // samedi
};

const daysInMonth = (month, year) => {
  return new Date(year, month, 0).getDate();
};

const getFirstDayOfMonth = (month, year) => {
  return new Date(year, month - 1, 1).getDay();
};

const getCurrentWeek = (day, month, year) => {
  const firstDayOfMonth = getFirstDayOfMonth(month, year);
  return Math.floor((day + map[firstDayOfMonth] - 2) / 7);
};

const getDaysArray = (month, year) => {
  const daysInMonthValue = daysInMonth(month, year);
  const firstDayOfMonth = getFirstDayOfMonth(month, year);
  const daysArray = new Array(daysInMonthValue)
    .fill(0)
    .map((_, index) => index + 1);

  // Jours du mois précédent
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const daysInPrevMonth = daysInMonth(prevMonth, prevYear);
  const prevMonthDays = Array.from(
    { length: map[firstDayOfMonth] - 1 },
    (_, i) => daysInPrevMonth - (map[firstDayOfMonth] - 2 - i),
  );

  // Jours du mois suivant (pour compléter la grille à 42 jours)
  const totalDays = prevMonthDays.length + daysArray.length;
  const nextMonthDaysCount = 42 - totalDays;
  const nextMonthDays = Array.from(
    { length: nextMonthDaysCount },
    (_, i) => i + 1,
  );

  return [
    ...prevMonthDays.map((day, index) => ({
      day,
      currentMonth: false,
      isTheFirstDayOfTheWeek: index % 7 === 0,
    })),
    ...daysArray.map((day, index) => ({
      day,
      currentMonth: true,
      isTheFirstDayOfTheWeek: (prevMonthDays.length + index) % 7 === 0,
      isTheLastDayOfTheWeek: (prevMonthDays.length + index) % 7 === 6,
      currentWeek:
        month === new Date().getMonth() + 1 &&
        year === new Date().getFullYear() &&
        Math.floor((prevMonthDays.length + index) / 7),
      today:
        day === new Date().getDate() &&
        month === new Date().getMonth() + 1 &&
        year === new Date().getFullYear(),
    })),
    ...nextMonthDays.map((day, index) => ({
      day,
      currentMonth: false,
      isTheFirstDayOfTheWeek:
        (prevMonthDays.length + daysArray.length + index) % 7 === 0,
    })),
  ];
};

const monthNames = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

const currentMonth = ref(2);
const currentYear = ref(2026);
const currentWeek = getCurrentWeek(
  new Date().getDate(),
  new Date().getMonth() + 1,
  new Date().getFullYear(),
);

const days = computed(() =>
  getDaysArray(currentMonth.value, currentYear.value),
);
const monthLabel = computed(
  () => `${monthNames[currentMonth.value - 1]} ${currentYear.value}`,
);

const goToPrevMonth = () => {
  if (currentMonth.value === 1) {
    currentMonth.value = 12;
    currentYear.value -= 1;
    return;
  }
  currentMonth.value -= 1;
};

const goToNextMonth = () => {
  if (currentMonth.value === 12) {
    currentMonth.value = 1;
    currentYear.value += 1;
    return;
  }
  currentMonth.value += 1;
};

console.log(days.value);
</script>
<style scoped>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  user-select: none;
  font-family: "Montserrat", sans-serif;
}
.parent-section {
  width: 100%;
  aspect-ratio: 1/1;
}
.mini-titre {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  margin-left: 10px;
}
#mini-titre__moi {
  font-size: 1rem;
  font-weight: 600;
}
.mini-titre__btns {
  display: flex;
  flex-direction: row;
  gap: 5px;
}
.mini-titre__btns--prev,
.mini-titre__btns--next {
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 50%;
  background-color: var(--color-white);
  color: var(--color-text);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  font-weight: 600;
  transition: all 0.3s ease;
}
.mini-titre__btns--prev:hover,
.mini-titre__btns--next:hover {
  background-color: var(--color-surface-muted);
}
.mini-titre__btns--prev:active,
.mini-titre__btns--next:active {
  background-color: var(--color-primary-soft);
}

.days-section {
  width: 100%;
  height: 100%;

  display: grid;
  grid-template-rows: auto 1fr;
}

.days-section--names {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
}
.days-section--names > div {
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 500;
  font-size: 0.8rem;
  color: var(--color-text);
}

.days-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  grid-template-rows: repeat(6, 1fr);
}

.day {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  color: var(--color-text);
  position: relative;
}
.day:hover {
  background-color: var(--color-surface-muted);
  border-radius: 50%;
  cursor: pointer;
}

.day.other-month {
  font-weight: 100;
  color: var(--color-text-muted);
}
.today {
  background-color: var(--color-primary-soft);
  color: var(--color-primary);
  border-radius: 50%;
  font-weight: 600;
}
.current-week:not(.the-first-day-of-the-week):not(
    .the-last-day-of-the-week
  )::before {
  content: "";
  position: absolute;
  width: 100%;
  height: 80%;
  background-color: var(--color-drop-border);
  opacity: 0.3;
  z-index: -1;
}
.the-first-day-of-the-week.current-week::before {
  content: "";
  position: absolute;
  width: 100%;
  height: 80%;
  background-color: var(--color-drop-border);
  opacity: 0.3;
  z-index: -1;
  border-radius: 5px 0 0 5px;
}
.the-last-day-of-the-week.current-week::before {
  content: "";
  position: absolute;
  width: 100%;
  height: 80%;
  background-color: var(--color-drop-border);
  opacity: 0.3;
  z-index: -1;
  border-radius: 0 5px 5px 0;
}
</style>
