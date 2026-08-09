/**
 * Vastu Knowledge — directions, elements and remedies.
 * NOTE: must stay exported as VASTU_DATA and imported by prisma/seed.ts;
 * it was orphaned (camelCase, unimported) which left category 'vastu' empty
 * in the DB while vastu.service.ts queried it on every request.
 */
export const VASTU_DATA = [
  {
    text: 'Vastu Shastra is the ancient Indian science of architecture and spatial design, dating back over 5,000 years. Based on the five elements (Pancha Bhootas) — Earth, Water, Fire, Air, and Space — Vastu aims to harmonize the energy flow in buildings to promote health, wealth, and happiness. The Vastu Purusha Mandala is the fundamental diagram mapping cosmic forces to the building.',
    category: 'vastu',
    topic: 'overview',
    source: 'Vastu Shastra Classical Texts',
  },
  {
    text: 'The eight cardinal and inter-cardinal directions in Vastu are governed by specific deities: North (Kubera — wealth), North-East (Ishana/Shiva — spirituality), East (Indra — prosperity), South-East (Agni — fire/energy), South (Yama — dharma), South-West (Nirrti — stability), West (Varuna — water/rain), North-West (Vayu — air/movement). Each direction has specific purposes and energies.',
    category: 'vastu',
    topic: 'directions',
    source: 'Vastu Shastra Classical Texts',
  },
  {
    text: 'The North-East (Ishanya) corner is the most sacred zone in Vastu. It should be kept clean, open, and at the lowest elevation. This is the ideal direction for the puja room, meditation area, and water sources (well, borewell, overhead tank). Heavy construction, toilets, or storage in this zone can cause spiritual and financial distress.',
    category: 'vastu',
    topic: 'northeast_zone',
    source: 'Vastu Remedies Handbook',
  },
  {
    text: 'Kitchen placement according to Vastu: The ideal location is the South-East (Agni corner). The cook should face East while cooking. The gas stove should not be directly in front of the kitchen entrance. Water elements (sink, water purifier) should be in the North-East of the kitchen. The South-East placement ensures fire energy is properly channeled for nourishment.',
    category: 'vastu',
    topic: 'kitchen_vastu',
    source: 'Vastu for Modern Homes',
  },
  {
    text: 'Vastu remedies without structural changes: Use Vastu pyramids to correct energy imbalances. Salt water bowls in corners absorb negative energy. Camphor burning purifies the space. Wind chimes in the North-West activate air element. Crystal balls in windows refract positive energy. Plants like Tulsi (North-East) and Money Plant (South-East) enhance specific energies.',
    category: 'vastu',
    topic: 'remedies',
    source: 'Vastu Remedies Handbook',
  },
  {
    text: 'Office Vastu: The owner/CEO should sit in the South-West facing North or East. The reception should be in the North-East. Accounts and finance in the South-East ensure monetary growth. The conference room works best in the North-West. Staff should sit facing North or East. Avoid sitting under beams or in front of pillars.',
    category: 'vastu',
    topic: 'office_vastu',
    source: 'Vastu for Business Success',
  },
];
