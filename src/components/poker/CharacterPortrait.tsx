import {pokerProfile} from './PokerPlayerProfile';
/** The same illustrated crop appears in seats, showdown and champion UI. */
export function CharacterPortrait({portrait=7,name}:{portrait?:number;name:string}) {
 return <img className="island-portrait" src={pokerProfile(portrait).asset} alt={name} draggable={false} style={{objectFit:'contain',imageRendering:'auto',borderRadius:0}}/>;
}
