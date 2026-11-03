'use client';
import roster from '../../../public/poker/profiles/manifest.json';

export function pokerProfile(portrait?:number){
 return roster.characters.find(c=>c.portrait===portrait)??roster.characters.find(c=>c.portrait===roster.defaultPortrait)!;
}
export function profileLevel(level?:number){return typeof level==='number'&&Number.isFinite(level)&&level>=1?Math.floor(level):roster.defaultLevel;}
/** Presentation only: no derived bot strength, account XP, or poker balances. */
export function PokerPlayerProfile({portrait=7,name,chips,level,dealer=false,blind,active=false,folded=false}:{
 portrait?:number;name:string;chips:string;level?:number;dealer?:boolean;blind?:'SB'|'BB';active?:boolean;folded?:boolean;
}){
 const character=pokerProfile(portrait);
 return <div className={`poker-player-profile${active?' is-active':''}${folded?' is-folded':''}`} data-character={character.id}>
  <img className="poker-profile-art" src={character.asset} alt={`${character.label} 프로필`} draggable={false}/>
  {dealer&&<span className="poker-profile-dealer" aria-label="딜러 D"><img src="/poker/profiles/dealer-disc.png" alt=""/><b>D</b></span>}
  {blind&&<span className={`poker-profile-blind ${blind.toLowerCase()}`} aria-label={blind==='SB'?'스몰 블라인드':'빅 블라인드'}>{blind}</span>}
  {folded&&<span className="poker-profile-fold">FOLD</span>}
  <div className="poker-profile-info">
   <div className="poker-profile-heading"><strong title={name}>{name}</strong><span className="poker-profile-level" aria-label={`레벨 ${profileLevel(level)}`}>★{profileLevel(level)}</span></div>
   <div className="poker-profile-chips" title={chips}>{chips}</div>
  </div>
 </div>;
}
