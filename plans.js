// Day plans. Which one shows depends on the day: a shift today, a day off after a
// shift that ended late, or a normal day off. Edit times and wording here.
(function () {
  const FOOD = {
    breakfast: ['Breakfast · ~750 kcal', 'Bagel with cream cheese, 3 eggs, a glass of whole milk, creatine.'],
    lunch: ['Lunch · ~750 kcal', 'Chicken or beef, a big serving of rice, vegetables, olive oil.'],
    shake: ['Shake · ~700 kcal', 'Whole milk, 1 scoop protein, a banana, 2 tbsp peanut butter, ½ cup oats.'],
    snack: ['Snack · ~300 kcal', 'Flavoured yogurt with granola, trail mix, or milk with peanut butter on half a bagel.'],
    dinner: ['Dinner · ~800 kcal', 'Pasta with meat sauce, or salmon with potatoes.']
  };
  const f = (key, time) => ({key, time, what: FOOD[key][0], note: FOOD[key][1], type: 'food'});
  const b = (key, time, what, note, type, mins) => ({key, time, what, note: note || '', type: type || '', mins});

  window.HQ_PLANS = {
    off: {label: 'Day off', bed: '10:00 pm', items: [
      b('wake', '6:00 am', 'Get up', 'Water and daylight before your phone. Phone stays in another room until 2 pm.'),
      b('gym', '6:15 am', 'Gym or run · 45 min', 'Do it first, before your brain starts negotiating.', 'move', 45),
      f('breakfast', '7:00 am'),
      b('study1', '7:30 am', 'School block 1 · 1h 45', '', 'study', 50),
      b('study2', '9:30 am', 'School block 2 · 1h 45', 'Take a 15-minute break away from screens first.', 'study', 50),
      f('lunch', '11:15 am'),
      b('study3', '12:00 pm', 'School block 3 · 1h 45', '', 'study', 50),
      b('business', '2:00 pm', 'Business · 5 contacts', 'Then clear one Needs-you item.', 'work', 50),
      f('shake', '3:00 pm'),
      b('french', '3:15 pm', 'French · 30 min', 'With Claude: questions in French, explanations in English.', 'work', 30),
      f('dinner', '6:00 pm'),
      f('snack', '8:30 pm'),
      b('review', '9:30 pm', 'Tick off today, look at tomorrow', '5 minutes, then screens off.')
    ]},
    late: {label: 'Day off after a late shift', bed: '11:30 pm', items: [
      b('wake', '9:30 am', 'Get up', 'That was 8 hours of sleep. Daylight and water before your phone.'),
      f('breakfast', '9:45 am'),
      b('study1', '10:00 am', 'School block 1 · 1h 45', '', 'study', 50),
      f('lunch', '12:00 pm'),
      b('study2', '12:45 pm', 'School block 2 · 1h 45', '', 'study', 50),
      b('gym', '2:45 pm', 'Gym or run · 45 min', 'It fits the afternoon energy dip.', 'move', 45),
      f('shake', '3:30 pm'),
      b('study3', '3:45 pm', 'School block 3 · 1h 30', '', 'study', 50),
      b('business', '5:15 pm', 'Business · 5 contacts', '', 'work', 50),
      f('dinner', '6:30 pm'),
      b('french', '7:30 pm', 'French · 30 min', 'With Claude: questions in French, explanations in English.', 'work', 30),
      f('snack', '8:30 pm'),
      b('review', '11:00 pm', 'Tick off today, look at tomorrow', '5 minutes, then screens off.')
    ]},
    shiftAM: {label: 'Morning shift', bed: '8:45 pm', items: [
      b('wake', '4:45 am', 'Get up', 'Water and light straight away. You prepped last night, so just go.'),
      f('breakfast', '5:00 am'),
      b('pack', '5:10 am', 'Grab lunch, shake and water', 'Packed the night before.'),
      b('work', '5:30 am', 'Meadow Park', 'Morning shift. Work is your training today: no gym.'),
      b('french', 'On break', 'French · 15 min', 'Short is fine on shift days. Just don’t skip it.', 'work', 15),
      f('lunch', 'On break'),
      f('shake', '3:15 pm'),
      b('business', '3:30 pm', 'Business · 5 contacts', 'Even 5 quick messages count.', 'work', 25),
      b('study1', '4:15 pm', 'School · 1 hour', 'One Economics lesson + its Response.', 'study', 50),
      f('dinner', '6:00 pm'),
      b('stretch', '7:00 pm', 'Stretch · 10 min', '', 'move', 10),
      b('prep', '7:30 pm', 'Pack tomorrow’s lunch and shake', 'Lay out work clothes too.'),
      b('review', '8:15 pm', 'Tick off today, look at tomorrow', '5 minutes, then screens off. Bed by 8:45 for 8 hours.')
    ]},
    shiftPM: {label: 'Night shift', bed: '1:15 am', items: [
      b('wake', '8:30 am', 'Get up', 'Daylight and water before your phone.'),
      f('breakfast', '8:45 am'),
      b('study1', '9:15 am', 'School · 1h 15', 'Do school first while your head is fresh.', 'study', 50),
      b('business', '10:45 am', 'Business · 5 contacts', 'Then clear one Needs-you item.', 'work', 25),
      f('lunch', '12:00 pm'),
      b('french', '12:45 pm', 'French · 30 min', 'With Claude: questions in French, explanations in English.', 'work', 30),
      b('rest', '1:30 pm', 'Rest or walk · 30 min', 'Long night ahead. No naps after 2.', 'move', 30),
      b('pack', '2:15 pm', 'Pack dinner, the shake and water', 'Night shifts are where the calories go missing.'),
      b('work', '3:00 pm', 'Meadow Park', 'Night shift. Work is your training today: no gym.'),
      f('dinner', 'On break'),
      f('shake', 'Late break'),
      b('review', '12:45 am', 'Tick off today, look at tomorrow', 'Quick, then 30 min with no screens before bed.')
    ]},
    shift: {label: 'Shift day', bed: '8 hours before your alarm', items: [
      b('wake', 'Morning', 'Get up', 'Daylight and water before your phone.'),
      f('breakfast', 'Before work'),
      b('pack', 'Before work', 'Pack lunch, the shake and a water bottle', 'Shift days are where the calories go missing.'),
      b('work', 'Shift', 'Meadow Park', '9 hours. Work is your training today: no gym.'),
      b('french', 'On break', 'French · 15 min', 'Short is fine on shift days. Just don’t skip it.', 'work', 15),
      f('lunch', 'On break'),
      f('shake', 'After work'),
      b('business', 'After work', 'Business · 5 contacts', 'Even 5 quick messages count.', 'work', 25),
      b('study1', 'After work', 'School · 1 hour', 'One Economics lesson + its Response.', 'study', 50),
      f('dinner', 'Evening'),
      b('stretch', 'Evening', 'Stretch · 10 min', '', 'move', 10),
      b('review', 'Before bed', 'Tick off today, look at tomorrow', '5 minutes. After a late finish, 30–45 min with no screens before bed.')
    ]}
  };
})();
