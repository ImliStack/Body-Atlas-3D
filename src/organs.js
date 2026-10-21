import MODELS from './organ-models.json'

// Organs that open a detailed OrganUI model. `concepts` are the BodyParts3D
// concepts that make up the organ inside the whole-body model; clicking any of
// their meshes opens the deep-dive. Order matters: earlier organs win shared meshes.
export const ORGANS = {
  eye: {
    title: 'Eye', latin: 'Oculus', system: 'sensory', concepts: ['left eyeball', 'right eyeball'],
    tags: ['Sense organ', 'Vision'],
    text: 'A fluid-filled sphere about the size of a large marble. The cornea and lens focus light onto the retina, which turns it into nerve signals for the brain.',
    facts: [['ruler', 'Diameter', '≈ 24 mm'], ['layers', 'Wall layers', 'Three'], ['link', 'Muscles moving it', 'Six']],
    caption: 'A camera that focuses itself, refreshed every blink.',
  },
  gallbladder: {
    title: 'Gallbladder', latin: 'Vesica biliaris', system: 'digestive', concepts: ['gallbladder'],
    tags: ['Organ', 'Bile store'],
    text: 'A small pear-shaped sac under the liver. It stores and concentrates bile, then squeezes it into the intestine after a fatty meal.',
    facts: [['flow', 'Holds', '≈ 50 mL of bile'], ['ruler', 'Length', '≈ 8 cm']],
    caption: 'A small pouch that waits for dinner.',
  },
  larynx: {
    title: 'Larynx', latin: 'Larynx', system: 'respiratory',
    concepts: ['thyroid cartilage', 'cricoid cartilage', 'epiglottis', 'muscle of larynx', 'ligament of larynx'],
    tags: ['Airway', 'Voice box'],
    text: 'The voice box at the top of the windpipe. Cartilages hold it open, the epiglottis guards it when you swallow, and vibrating vocal folds make your voice.',
    facts: [['layers', 'Main cartilages', 'Nine'], ['pulse', 'Vocal fold vibration', '100–250 Hz']],
    caption: 'Where breath becomes a voice.',
  },
  esophagus: {
    title: 'Esophagus', latin: 'Oesophagus', system: 'digestive', concepts: ['esophagus'],
    tags: ['Digestive tract', 'Muscle tube'],
    text: 'A muscular tube from the throat to the stomach, running behind the windpipe and heart. Waves of muscle contraction push each swallow down.',
    facts: [['ruler', 'Length', '≈ 25 cm'], ['flow', 'Food transit', '≈ 8 seconds']],
    caption: 'Every swallow, carried by a wave.',
  },
  stomach: {
    title: 'Stomach', latin: 'Gaster', system: 'digestive', concepts: ['stomach'],
    tags: ['Organ', 'Digestion'],
    text: 'A J-shaped muscular bag under the left ribs. It churns food with acid and enzymes into a thick liquid before passing it to the small intestine.',
    facts: [['flow', 'Capacity', '≈ 1–1.5 L'], ['spark', 'Acidity', 'pH 1.5–3.5']],
    caption: 'A churning chamber of acid and muscle.',
  },
  pancreas: {
    title: 'Pancreas', latin: 'Pancreas', system: 'digestive', concepts: ['pancreas'],
    tags: ['Gland', 'Digestion', 'Hormones'],
    text: 'A long gland tucked behind the stomach. It sends digestive enzymes into the intestine and releases insulin and glucagon into the blood.',
    facts: [['ruler', 'Length', '≈ 15 cm'], ['flow', 'Juice per day', '≈ 1.5 L']],
    caption: 'Two jobs: digest the meal, balance the sugar.',
  },
  spleen: {
    title: 'Spleen', latin: 'Lien', system: 'lymphatic', concepts: ['spleen'],
    tags: ['Organ', 'Blood filter', 'Immunity'],
    text: 'A fist-sized organ under the left ribs. It filters the blood, recycles old red blood cells and helps the immune system spot infections.',
    facts: [['ruler', 'Length', '≈ 11 cm'], ['spark', 'Role', 'Filter + immune hub']],
    caption: 'The body’s quiet blood recycler.',
  },
  bladder: {
    title: 'Bladder', latin: 'Vesica urinaria', system: 'urinary', concepts: ['urinary bladder'],
    tags: ['Organ', 'Urinary tract'],
    text: 'A stretchy muscular reservoir in the pelvis. It fills with urine from the ureters and empties through the urethra.',
    facts: [['flow', 'Capacity', '≈ 400–600 mL'], ['link', 'Fed by', 'Two ureters']],
    caption: 'Stretches to hold, squeezes to empty.',
  },
  kidneys: {
    title: 'Kidneys', latin: 'Renes', system: 'urinary', concepts: ['kidney'],
    tags: ['Organ', 'Filter'],
    text: 'Two bean-shaped organs against the back wall of the abdomen. Together they filter the whole blood volume many times a day and balance water and salts.',
    facts: [['flow', 'Filtered per day', '≈ 180 L'], ['ruler', 'Length', '≈ 11 cm each']],
    caption: 'Two small filters, a whole bath of blood each day.',
  },
  liver: {
    title: 'Liver', latin: 'Hepar', system: 'digestive', concepts: ['liver'],
    tags: ['Organ', 'Metabolism'],
    text: 'The largest internal organ, under the right side of the diaphragm. It processes nutrients, makes bile and proteins, and clears toxins from the blood.',
    facts: [['ruler', 'Mass', '≈ 1.5 kg'], ['spark', 'Jobs', '500+ functions'], ['flow', 'Superpower', 'Regrows itself']],
    caption: 'The body’s chemical factory, working in silence.',
  },
  intestines: {
    title: 'Intestines', latin: 'Intestina', system: 'digestive', concepts: ['small intestine', 'large intestine'],
    tags: ['Digestive tract', 'Absorption'],
    text: 'Metres of folded tube filling the abdomen. The small intestine absorbs nutrients; the large intestine reclaims water and forms waste.',
    facts: [['ruler', 'Small intestine', '≈ 6 m'], ['ruler', 'Large intestine', '≈ 1.5 m']],
    caption: 'Seven metres of tube, folded to fit.',
  },
  brain: {
    title: 'Brain', latin: 'Encephalon', system: 'nervous', concepts: ['brain'],
    tags: ['Organ', 'Control centre'],
    text: 'The command centre of the nervous system. Its folded lobes, deep structures and brainstem handle perception, movement, memory, language and the automatic work of staying alive.',
    facts: [['spark', 'Neurons', '≈ 86 billion'], ['ruler', 'Mass', '≈ 1.4 kg'], ['flow', 'Power use', '≈ 20 W']],
    caption: 'A kilogram and a half that holds everything you know.',
  },
  heart: {
    title: 'Heart', latin: 'Cor', system: 'cardiac', concepts: ['heart'], idle: 'heartbeat',
    tags: ['Organ', 'Muscle', 'Pump'],
    text: 'A fist-sized muscular pump behind the breastbone. Two upper chambers receive blood, two lower chambers push it out — to the lungs on the right, to the whole body on the left.',
    facts: [['pulse', 'Beats per day', '≈ 100,000'], ['layers', 'Chambers', 'Four'], ['flow', 'Output at rest', '≈ 5 L / min']],
    caption: 'Four rooms, one rhythm, never a day off.',
  },
  lungs: {
    title: 'Lungs', latin: 'Pulmones', system: 'respiratory', concepts: ['left lung', 'right lung'], idle: 'breath',
    tags: ['Organ', 'Gas exchange'],
    text: 'Two spongy organs filling the chest, each divided into lobes and segments. Air branches down the bronchi into millions of tiny sacs where oxygen crosses into the blood.',
    facts: [['layers', 'Lobes', '3 right · 2 left'], ['ruler', 'Exchange surface', '≈ 70 m²'], ['pulse', 'Breaths per day', '≈ 20,000']],
    caption: 'A tennis court of surface folded into your chest.',
  },
}

for (const [key, organ] of Object.entries(ORGANS)) organ.model = MODELS[key]

// Quick picks along the top of the stage. Organs open the deep-dive; bones select in place.
export const PICKS = [
  { organ: 'heart' }, { organ: 'brain' }, { organ: 'lungs' }, { organ: 'liver' }, { organ: 'kidneys' },
  { organ: 'stomach' }, { organ: 'eye' }, { featured: 'skull' }, { featured: 'spine' }, { featured: 'femur' },
]
