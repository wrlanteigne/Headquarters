// Day plans. Which one shows depends on the day: a shift today, a day off after a
// shift that ended late, or a normal day off. Edit times and wording here.
(function () {
  const b = (key, time, what, note, type, mins) => ({key, time, what, note: note || '', type: type || '', mins});

  window.HQ_PLANS = {
    off: {label: 'Day off', bed: '10:00 pm', items: [
      b('wake', '6:00 am', 'Get up', 'Water and daylight before your phone. Phone stays in another room until 2 pm.'),
      b('study1', '7:30 am', 'School block 1 · 1h 45', '', 'study', 50),
      b('study2', '9:30 am', 'School block 2 · 1h 45', 'Take a 15-minute break away from screens first.', 'study', 50),
      b('study3', '12:00 pm', 'School block 3 · 1h 45', '', 'study', 50),
      b('business', '2:00 pm', 'Business · 5 contacts', 'Then clear one Needs-you item.', 'work', 50),
      b('french', '3:15 pm', 'French · 30 min', 'With Claude: questions in French, explanations in English.', 'work', 30),
      b('review', '9:30 pm', 'Tick off today, look at tomorrow', '5 minutes, then screens off.')
    ]},
    late: {label: 'Day off after a late shift', bed: '11:30 pm', items: [
      b('wake', '9:30 am', 'Get up', 'That was 8 hours of sleep. Daylight and water before your phone.'),
      b('study1', '10:00 am', 'School block 1 · 1h 45', '', 'study', 50),
      b('study2', '12:45 pm', 'School block 2 · 1h 45', '', 'study', 50),
      b('study3', '3:45 pm', 'School block 3 · 1h 30', '', 'study', 50),
      b('business', '5:15 pm', 'Business · 5 contacts', '', 'work', 50),
      b('french', '7:30 pm', 'French · 30 min', 'With Claude: questions in French, explanations in English.', 'work', 30),
      b('review', '11:00 pm', 'Tick off today, look at tomorrow', '5 minutes, then screens off.')
    ]},
    shiftAM: {label: 'Morning shift', bed: '8:45 pm', items: [
      b('wake', '4:45 am', 'Get up', 'Water and light straight away. You prepped last night, so just go.'),
      b('pack', '5:10 am', 'Grab lunch and water', 'Packed the night before.'),
      b('work', '5:30 am', 'Meadow Park', 'Morning shift.'),
      b('french', 'On break', 'French · 15 min', 'Short is fine on shift days. Just don’t skip it.', 'work', 15),
      b('business', '3:30 pm', 'Business · 5 contacts', 'Even 5 quick messages count.', 'work', 25),
      b('study1', '4:15 pm', 'School · 1 hour', 'One Economics lesson + its Response.', 'study', 50),
      b('stretch', '7:00 pm', 'Stretch · 10 min', '', 'move', 10),
      b('prep', '7:30 pm', 'Pack tomorrow’s lunch', 'Lay out work clothes too.'),
      b('review', '8:15 pm', 'Tick off today, look at tomorrow', '5 minutes, then screens off. Bed by 8:45 for 8 hours.')
    ]},
    shiftPM: {label: 'Night shift', bed: '1:15 am', items: [
      b('wake', '8:30 am', 'Get up', 'Daylight and water before your phone.'),
      b('study1', '9:15 am', 'School · 1h 15', 'Do school first while your head is fresh.', 'study', 50),
      b('business', '10:45 am', 'Business · 5 contacts', 'Then clear one Needs-you item.', 'work', 25),
      b('french', '12:45 pm', 'French · 30 min', 'With Claude: questions in French, explanations in English.', 'work', 30),
      b('rest', '1:30 pm', 'Rest or walk · 30 min', 'Long night ahead. No naps after 2.', 'move', 30),
      b('pack', '2:15 pm', 'Pack dinner and water', 'Eat a real meal before you leave.'),
      b('work', '3:00 pm', 'Meadow Park', 'Night shift.'),
      b('review', '12:45 am', 'Tick off today, look at tomorrow', 'Quick, then 30 min with no screens before bed.')
    ]},
    shift: {label: 'Shift day', bed: '8 hours before your alarm', items: [
      b('wake', 'Morning', 'Get up', 'Daylight and water before your phone.'),
      b('pack', 'Before work', 'Pack lunch and a water bottle', ''),
      b('work', 'Shift', 'Meadow Park', '9 hours.'),
      b('french', 'On break', 'French · 15 min', 'Short is fine on shift days. Just don’t skip it.', 'work', 15),
      b('business', 'After work', 'Business · 5 contacts', 'Even 5 quick messages count.', 'work', 25),
      b('study1', 'After work', 'School · 1 hour', 'One Economics lesson + its Response.', 'study', 50),
      b('stretch', 'Evening', 'Stretch · 10 min', '', 'move', 10),
      b('review', 'Before bed', 'Tick off today, look at tomorrow', '5 minutes. After a late finish, 30–45 min with no screens before bed.')
    ]}
  };
})();
