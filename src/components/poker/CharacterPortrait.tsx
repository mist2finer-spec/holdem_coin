import type {CSSProperties} from 'react';
// The intact source sheets remain reusable for future rigging. CSS crops only
// the assembled pixel portrait; no parts atlas or normal map is displayed.
const crops:Record<number,[number,number,number,number]>={
  1:[.295,.245,.15,.37],2:[.30,.235,.15,.38],3:[.29,.085,.15,.38],
  4:[.30,.215,.15,.38],5:[.295,.13,.16,.38],6:[.27,.13,.19,.38],
  7:[.28,.13,.18,.38],8:[.30,.21,.15,.38],9:[.28,.09,.17,.38],
};
export function CharacterPortrait({portrait=4,name}:{portrait?:number;name:string}) {
 const [x,y,w,h]=crops[portrait]||crops[4];
 return <div role="img" aria-label={name} className="island-portrait" style={{
  backgroundImage:`url('/island/chr_${portrait}.jpg')`,backgroundSize:`${100/w}% ${100/h}%`,
  backgroundPosition:`${x/(1-w)*100}% ${y/(1-h)*100}%`,
 } as CSSProperties}/>;
}
