import { EffectComposer, N8AO, SMAA, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'

/** High-quality mode: ambient occlusion settles the pieces into each other; plus antialiasing. */
export default function Effects() {
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <N8AO aoRadius={0.05} distanceFalloff={0.6} intensity={2} halfRes quality="medium" />
      <SMAA />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  )
}
