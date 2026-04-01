interface SeedData { text: string; category: string; topic: string; source: string; }

export const HEALTH_ASTROLOGY_DATA: SeedData[] = [
  // ─── Planet-Body Mappings ─────────────────────────────────────────────────
  {
    text: 'Sun and Heart Health: Sun governs the heart, circulatory system, right eye, bones (spine), and overall vitality. A weak or afflicted Sun in the birth chart predisposes to heart disease, low blood pressure, eye problems, and vitamin D deficiency. Sun in the 6th or 8th house requires extra cardiac vigilance. Remedies: Surya Namaskar daily, Ruby gemstone, copper vessel water at sunrise. Sun periods (Dasha/transit) activate heart-related health events. Leo ascendant natives must prioritize cardiac health after age 40.',
    category: 'health', topic: 'sun_health', source: 'Brihat Parashara Hora Shastra',
  },
  {
    text: 'Moon and Mental Health: Moon governs the mind, emotions, blood, bodily fluids, left eye, breasts, and sleep cycle. A weak Moon causes depression, anxiety, insomnia, water retention, hormonal imbalance, and menstrual disorders. Moon in the 6th, 8th, or 12th house with malefic aspects indicates mental health vulnerability. Full Moon and New Moon days amplify emotional sensitivity. Remedies: Pearl gemstone, silver water therapy, milk and rice offerings on Mondays, Chandra Namaskar. Moon-Saturn conjunction is the strongest indicator of depression in Vedic astrology.',
    category: 'health', topic: 'moon_health', source: 'Brihat Parashara Hora Shastra',
  },
  {
    text: 'Mars and Blood/Muscle Health: Mars governs blood, muscles, bone marrow, adrenal glands, and the immune defense system. A weak Mars causes anemia, low blood pressure, muscle weakness, and susceptibility to infections. An afflicted (excess) Mars causes high blood pressure, inflammation, fevers, accidents, and surgical situations. Mars in the 6th house often indicates surgery at some point in life. Remedies: Red Coral gemstone, Hanuman Chalisa on Tuesdays, iron-rich diet. Mars-Ketu conjunction increases accident risk — caution during Mars Dasha.',
    category: 'health', topic: 'mars_health', source: 'Brihat Parashara Hora Shastra',
  },
  {
    text: 'Mercury and Nervous System Health: Mercury governs the nervous system, skin, speech, hands, lungs, and intestines. A weak Mercury causes speech disorders, skin diseases (eczema, psoriasis), respiratory allergies, anxiety, and intestinal problems (IBS). Mercury afflicted by Rahu causes overthinking, OCD, and nervous breakdowns. Mercury combustion (too close to Sun) weakens intellect temporarily. Remedies: Emerald gemstone, Brahmi and Ashwagandha herbs, green moong dal consumption, Pranayama breathing exercises. Writers and IT professionals with weak Mercury need regular digital detox.',
    category: 'health', topic: 'mercury_health', source: 'Brihat Parashara Hora Shastra',
  },
  {
    text: 'Jupiter and Liver/Metabolic Health: Jupiter governs the liver, gallbladder, fat metabolism, pancreas, and the body\'s expansion principle. A weak Jupiter causes liver disorders, diabetes, obesity, tumors, and poor fat digestion. An afflicted Jupiter leads to excessive weight gain, high cholesterol, and fatty liver disease. Jupiter in the 6th house with Saturn aspects increases diabetes risk. Remedies: Yellow Sapphire gemstone, turmeric in daily diet, Thursday fasting, Guru Beej Mantra. Jupiter-dominant people must monitor blood sugar and cholesterol regularly after age 35.',
    category: 'health', topic: 'jupiter_health', source: 'Brihat Parashara Hora Shastra',
  },
  {
    text: 'Venus and Reproductive/Kidney Health: Venus governs the reproductive system, kidneys, urinary tract, throat, and facial beauty. A weak Venus causes reproductive health issues, PCOS, kidney stones, urinary infections, throat problems, and hormonal imbalance. Venus afflicted by Saturn delays marriage and causes reproductive difficulties. Venus-Mars combination may indicate STDs or excessive sexual energy. Remedies: Diamond or White Sapphire, rose water consumption, white rice and sugar offerings on Fridays. Venus Dasha activates reproductive health events — fertility peaks during strong Venus periods.',
    category: 'health', topic: 'venus_health', source: 'Brihat Parashara Hora Shastra',
  },
  {
    text: 'Saturn and Bone/Joint Health: Saturn governs bones, teeth, knees, joints, hair, nails, and the aging process. A weak Saturn causes early aging, arthritis, osteoporosis, dental problems, chronic pain, and depression. Saturn in the Lagna or 6th house with malefic aspects indicates chronic health conditions. Sade Sati period (7.5 years) is the peak health vulnerability window for Saturn-related issues. Remedies: Blue Sapphire (only if compatible), sesame oil massage (Abhyanga), calcium-rich diet, Saturday mustard oil donation. Weight-bearing exercise is essential for Saturn-dominant charts.',
    category: 'health', topic: 'saturn_health', source: 'Brihat Parashara Hora Shastra',
  },

  // ─── House-Health Mappings ────────────────────────────────────────────────
  {
    text: '1st House (Lagna) and General Health: The ascendant represents overall constitution, physical body, and vitality. A strong Lagna lord in a good house with benefic aspects indicates robust health throughout life. Malefics (Saturn, Mars, Rahu) in the 1st house or aspecting it create constitutional weakness. The sign on the Lagna determines the body type: fire signs (Aries, Leo, Sagittarius) — Pitta constitution; earth signs (Taurus, Virgo, Capricorn) — Kapha; air signs (Gemini, Libra, Aquarius) — Vata; water signs (Cancer, Scorpio, Pisces) — Kapha-Pitta mixed.',
    category: 'health', topic: 'first_house_health', source: 'Brihat Parashara Hora Shastra',
  },
  {
    text: '6th House and Disease Indicators: The 6th house is the house of disease, enemies, and debts. Planets in the 6th house indicate specific disease vulnerabilities: Sun — fevers, heart; Moon — mental illness, water retention; Mars — surgery, accidents, inflammation; Mercury — skin, nerves; Jupiter — liver, obesity; Venus — reproductive, kidney; Saturn — chronic conditions, bones; Rahu — mysterious illness, poisoning; Ketu — sudden illness, misdiagnosis. The 6th house lord\'s placement shows where disease manifests. Strong 6th house actually indicates ability to overcome disease.',
    category: 'health', topic: 'sixth_house_health', source: 'Brihat Parashara Hora Shastra',
  },
  {
    text: '8th House and Chronic/Transformative Health: The 8th house governs chronic conditions, longevity, surgery, and transformative health events. Planets in the 8th house create long-term health patterns: Saturn gives longevity but chronic pain; Mars indicates surgical events; Rahu causes mysterious or hard-to-diagnose conditions; Ketu causes sudden health crises. A strong 8th lord with benefic aspects indicates recovery from serious illness. The 8th house also governs reproductive health, prostate, and colon. Jupiter aspect on the 8th house protects longevity.',
    category: 'health', topic: 'eighth_house_health', source: 'Brihat Parashara Hora Shastra',
  },
  {
    text: '12th House and Hospitalization: The 12th house governs hospitalization, bed-ridden conditions, eye problems, and feet. Malefics in the 12th house increase the likelihood of hospitalization during their Dasha. Saturn in the 12th causes prolonged hospital stays. Rahu in the 12th causes sleep disorders, nightmares, and psychiatric conditions. Mars in the 12th indicates accidents during travel or injuries to feet. A strong 12th house lord paradoxically indicates good sleep and spiritual health. Jupiter in the 12th is considered protective — Vimala Yoga — reducing hospital risk.',
    category: 'health', topic: 'twelfth_house_health', source: 'Brihat Parashara Hora Shastra',
  },

  // ─── Common Health Doshas & Remedies ──────────────────────────────────────
  {
    text: 'Rahu and Anxiety/Phobias: Rahu afflicting Moon or the 4th house is the primary indicator of anxiety disorders, panic attacks, phobias, and obsessive thinking. Rahu-Moon conjunction (Grahan Yoga) causes persistent mental unrest and fear of the unknown. Rahu in the Lagna creates health anxiety and hypochondria. Rahu Dasha often triggers the onset of anxiety symptoms. Remedies: Hessonite gemstone, Durga Chalisa recitation, donating to orphans on Saturdays, avoiding intoxicants completely, Kali Kavach for protection from fears. Mindfulness meditation breaks Rahu\'s anxiety loop.',
    category: 'health', topic: 'rahu_anxiety', source: 'Brihat Parashara Hora Shastra',
  },
  {
    text: 'Ketu and Mysterious Illness: Ketu causes sudden, hard-to-diagnose illnesses that baffle modern medicine. Ketu afflicting the 6th or 8th house brings viral infections, autoimmune conditions, skin disorders with unknown cause, and allergic reactions to common substances. Ketu in the 1st house causes spiritual crisis manifesting as physical symptoms. Ketu Dasha activates past-life health karma. Remedies: Cat\'s Eye gemstone, Ganesha Atharvashirsha recitation, donating multi-colored blankets, Ayurvedic Panchakarma detox. Ketu responds well to spiritual healing and energy work.',
    category: 'health', topic: 'ketu_mysterious_illness', source: 'Brihat Parashara Hora Shastra',
  },
  {
    text: 'Weak Moon and Mental Health: Moon is the karaka (significator) of mind. A weak, afflicted, or debilitated Moon (in Scorpio) is the strongest indicator of mental health challenges: depression, bipolar disorder, emotional instability, and insomnia. Moon conjunct Saturn causes chronic melancholy and pessimism. Moon conjunct Rahu causes anxiety and irrational fears. Moon in the 6th, 8th, or 12th house without benefic aspects weakens emotional resilience. Remedies: Pearl gemstone, silver water, Chandra Namaskar, white food offerings on Mondays, therapeutic counseling during Moon Dasha.',
    category: 'health', topic: 'weak_moon_mental_health', source: 'Brihat Parashara Hora Shastra',
  },
  {
    text: 'Afflicted Mars and Surgery/Accidents: Mars governs surgical events, accidents, burns, and blood-related emergencies. Mars in the 6th or 8th house with Rahu or Ketu aspect significantly increases surgical probability. Mars-Saturn conjunction creates accident-prone periods. Mars Dasha with malefic transits is the highest-risk period for physical injuries. Remedies: Red Coral gemstone, Hanuman Chalisa on Tuesdays and Saturdays, avoid driving during Mars hora on Tuesdays, donate blood regularly (channels Mars energy positively), carry a copper coin. Surgeries should be scheduled during favorable Mars transit, never during Mars retrograde.',
    category: 'health', topic: 'mars_surgery_accidents', source: 'Brihat Parashara Hora Shastra',
  },
];
