// The two reference bodies. Each one is a packed atlas (manifest + binary chunks) in public/models;
// see public/ATTRIBUTION.md for sources and licences.

export const BODIES = {
  male: {
    id: 'male', label: 'Male',
    atlas: '/models/atlas.json',
    eyebrow: 'Homo sapiens · adult male reference',
    source: 'BodyParts3D 4.0',
    credit: 'BodyParts3D 4.0 © DBCLS (CC BY 4.0)',
    aliases: {},
    blurbs: {},
  },
  female: {
    id: 'female', label: 'Female',
    atlas: '/models/atlas-female.json',
    eyebrow: 'Homo sapiens · adult female reference',
    source: 'Human Reference Atlas, female v1.5',
    credit: 'HuBMAP Human Reference Atlas, 3D Reference Organ Set for Female v1.5 (CC BY 4.0)',
    note: 'Organs, spine, pelvis and legs come from the female reference set. The skull, ribcage, shoulders, arms, feet, muscles, vessels, nerves and glands are BodyParts3D structures fitted to this body, so every system is there as in the male body. Placenta and umbilical structures sit under Pregnancy reference and start hidden.',
    // The feature lists in data.js and organs.js use BodyParts3D (FMA) names. These are the
    // matching concept names in the female atlas, looked up in place of (or as well as) them.
    aliases: {
      'left eyeball': ['eye l'],
      'right eyeball': ['eye r'],
      epiglottis: ['epiglottic cartilage'],
      'muscle of larynx': ['larynx'],
      'large intestine': ['colon'],
      brain: ['allen brain'],
      'left lung': ['left lungs l'],
      'right lung': ['lungs r'],
      'vertebral column': ['vertebrae', 'fused sacrum'],
      sacrum: ['fused sacrum'],
      femur: ['right femur', 'left femur'],
      tibia: ['right tibia', 'left tibia'],
      fibula: ['right fibula', 'left fibula'],
      patella: ['right patella', 'left patella'],
    },
    blurbs: {
      reproductive: 'The female reproductive structures of this reference body: ovaries, uterine tubes, uterus and vagina, with the ligaments that hold them, and the mammary glands.',
      skeletal: 'The skeleton is the body’s scaffold. The spine, pelvis and legs come from the female reference set; the skull, ribcage, shoulders, arms and feet are BodyParts3D bones fitted to its proportions.',
    },
  },
}

export const BODY_IDS = Object.keys(BODIES)

/** Body from `?body=` in the address, then the last one used in this browser, else male. */
export function initialBody() {
  try {
    const q = new URLSearchParams(location.search).get('body')
    if (BODIES[q]) return q
    const v = JSON.parse(localStorage.getItem('atlas-body'))
    if (BODIES[v]) return v
  } catch {}
  return 'male'
}
