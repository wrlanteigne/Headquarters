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
      b('wake', '6:00 am', 'Get up', 'Water and daylight before your phone. Phone stays in another room until 7:30.'),
      b('gym', '6:15 am', 'Gym or run · 45 min', 'Do it first, before your brain starts negotiating.', 'move', 45),
      f('breakfast', '7:00 am'),
      b('study1', '7:30 am', 'School block 1', '', 'study', 50),
      b('study2', '9:45 am', 'School block 2', 'Take a 15-minute break away from screens first.', 'study', 50),
      f('lunch', '11:30 am'),
      b('business', '12:15 pm', 'Business · 5 contacts', 'Then clear one Needs-you item.', 'work', 50),
      b('french', '1:30 pm', 'French · 30 min', 'With Claude: questions in French, explanations in English.', 'work', 30),
      f('shake', '3:00 pm'),
      f('dinner', '6:00 pm'),
      f('snack', '8:30 pm'),
      b('review', '9:30 pm', 'Tick off today, look at tomorrow', '5 minutes, then screens off.')
    ]},
    late: {label: 'Day off after a late shift', bed: '11:30 pm', items: [
      b('wake', '9:30 am', 'Get up', 'That was 8 hours of sleep. Daylight and water before your phone.'),
      f('breakfast', '9:45 am'),
      b('study1', '10:00 am', 'School block 1', '', 'study', 50),
      f('lunch', '12:00 pm'),
      b('study2', '12:45 pm', 'School block 2', '', 'study', 50),
      b('gym', '2:00 pm', 'Gym or run · 45 min', 'It fits the afternoon energy dip.', 'move', 45),
      f('shake', '2:45 pm'),
      b('business', '3:00 pm', 'Business · 5 contacts', '', 'work', 50),
      b('french', '4:00 pm', 'French · 30 min', 'With Claude: questions in French, explanations in English.', 'work', 30),
      f('snack', '4:30 pm'),
      f('dinner', '6:30 pm'),
      b('review', '11:00 pm', 'Tick off today, look at tomorrow', '5 minutes, then screens off.')
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
      b('study1', 'After work', 'School · keep it short', '', 'study', 25),
      f('dinner', 'Evening'),
      b('stretch', 'Evening', 'Stretch · 10 min', '', 'move', 10),
      b('review', 'Before bed', 'Tick off today, look at tomorrow', '5 minutes. After a late finish, 30–45 min with no screens before bed.')
    ]}
  };
})();
