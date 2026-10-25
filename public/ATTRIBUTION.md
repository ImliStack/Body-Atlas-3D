# Anatomy data attribution

BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International.

- License: https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html (updated 2025-02-27)
- Dataset: https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html
- License terms: https://creativecommons.org/licenses/by/4.0/
- Source geometry: `isa_BP3D_4.0_obj_99.zip`, BodyParts3D 4.0.
- English names and relationships: IS-A and PART-OF concept, element, and inclusion tables from the same archive.
- Publication: Mitsuhashi et al. (2009), BodyParts3D: 3D structure database for anatomical concepts. https://doi.org/10.1093/nar/gkn613

Adaptations: axes and units converted from millimeters/Z-up to meters/Y-up; translated to rest at the stage; geometry simplified using meshoptimizer with 0.2% relative error limit per structure; normals quantized to signed 16-bit; packed into binary chunks; curated display system groupings and colors. The source contains 2,234 individual OBJ meshes; all remain represented. The combined hierarchy contains 3,432 named FMA concepts, which may reference multiple meshes. Original source identity is preserved in the manifest.

Source OBJ comments mention an older CC BY-SA 2.1 Japan license. The official current database license linked above supersedes that legacy text and explicitly permits redistribution and adaptation under CC BY 4.0.

BodyParts3D represents an adult male reference anatomy based on TARO MRI and anatomical illustration refinements. It is not a complete model of every possible human anatomical structure or variation. This interface is educational and is not a clinical tool.

## Female reference body

Kristen Browne and Heidi Schlehlein, Human Reference Atlas / HuBMAP, *3D Reference Organ Set for Female v1.5* (2023). CC BY 4.0. Geometry adapted for this viewer (`public/models/atlas-female.json`, `female-*.bin.gz`). Packed geometry from ashemag/human-atlas (MIT code, CC BY 4.0 data).

- Source DOI: https://doi.org/10.48539/HBM352.BTSQ.586
- Dataset: https://lod.humanatlas.io/ref-organ/united-female/v1.5
- Original GLB: https://cdn.humanatlas.io/digital-objects/ref-organ/united-female/v1.5/assets/3d-vh-f-united.glb
- License: https://creativecommons.org/licenses/by/4.0/

Adaptations: translated native meter/Y-up coordinates onto the stage, coincident vertices welded and source normals averaged, geometry simplified with a 0.2% per-structure relative error bound, and normals quantized. Colors and display systems are curated for this interface. All 888 source meshes are represented, with 1,073 source nodes available as selectable individual or compound concepts.

This is a reference assembly with whole-body surface and selected organs, including female reproductive anatomy. Its own skeleton covers the spine, pelvis and legs, and its muscle coverage is partial.

**Completed skeleton.** The skull, mandible, hyoid, ribcage, sternum, clavicles, scapulae, arm, hand and foot bones of the female body are 224 BodyParts3D 4.0 meshes (© DBCLS, CC BY 4.0) from the male reference, fitted region by region to the female landmarks: the skull to the brain, eyes and atlas vertebra; the ribcage and shoulder girdle to the thoracic spine and lungs; the arms rotated at the shoulder into the female pose read from the skin; the feet placed under each tibia. They are approximations of female bones, not female scan data. Built by `scripts/build-female-skeleton.mjs` into `female-10.bin.gz`.

**Muscles, vessels, nerves and glands.** 1,422 further BodyParts3D 4.0 structures (muscles, arteries, veins, peripheral nerves, connective tissue, endocrine glands, the esophagus, stomach, tongue, salivary glands and nasal/pharyngeal parts) are carried onto the female body by the bones around them: every vertex follows a distance-weighted blend of its nearest bones' male → female fits. Structures the female set already has (heart and coronary vessels, kidneys and renal vessels, brain, spinal cord, eyes) and male-only structures are left out. Same script, `female-11` to `female-15.bin.gz`; again approximations, not female scan data. It is not a complete model of every human structure or a single-person scan. Eight placenta/umbilical structures are classified under Pregnancy reference and hidden by default.
