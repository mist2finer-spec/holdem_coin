// Code-native table: raised leather rail, gold inner lip, recessed felt and skirt.
export function SalonTableSurface(){return <div className="salon-felt" aria-hidden="true">
 <div className="salon-table-skirt"/>
 <svg viewBox="0 0 360 640" preserveAspectRatio="none">
 <defs>
  <linearGradient id="salon-felt" x2="1" y2="1"><stop stopColor="#06494c"/><stop offset=".5" stopColor="#0a6970"/><stop offset="1" stopColor="#043b43"/></linearGradient>
  <linearGradient id="salon-rail" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#77717a"/><stop offset=".035" stopColor="#34333d"/><stop offset=".48" stopColor="#1b1c25"/><stop offset=".91" stopColor="#38333d"/><stop offset="1" stopColor="#10121b"/></linearGradient>
  <linearGradient id="salon-gold"><stop stopColor="#755023"/><stop offset=".35" stopColor="#ffe4a4"/><stop offset=".65" stopColor="#a87130"/><stop offset="1" stopColor="#e9bd72"/></linearGradient>
  <filter id="salon-recess" x="-10%" y="-10%" width="120%" height="120%">
   <feComponentTransfer in="SourceAlpha" result="inverse"><feFuncA type="table" tableValues="1 0"/></feComponentTransfer>
   <feGaussianBlur in="inverse" stdDeviation="9"/><feOffset dy="4"/><feComposite in2="SourceAlpha" operator="in" result="edge"/>
   <feFlood floodColor="#000e17" floodOpacity=".8"/><feComposite in2="edge" operator="in" result="shade"/>
   <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="shade"/></feMerge>
  </filter>
  <pattern id="salon-stitch" width="160" height="160" patternUnits="userSpaceOnUse"><path d="M80 0 160 80 80 160 0 80Z" fill="none" stroke="#8cd0ca" strokeOpacity=".08" strokeWidth="1"/><path d="m80 61 7 9 11-1-1 11 9 7-9 7 1 11-11-1-7 9-7-9-11 1 1-11-9-7 9-7-1-11 11 1Z" fill="none" stroke="#a7d8cc" strokeOpacity=".1"/></pattern>
 </defs>
 <rect x="3" y="3" width="354" height="634" rx="152" fill="url(#salon-rail)" stroke="#11131a" strokeWidth="3"/>
 <rect x="7" y="7" width="346" height="626" rx="148" fill="none" stroke="#b7adb1" strokeOpacity=".4" strokeWidth="2"/>
 <rect x="16" y="16" width="328" height="608" rx="140" fill="none" stroke="#090d16" strokeWidth="2"/>
 <rect x="26" y="26" width="308" height="588" rx="130" fill="url(#salon-felt)" stroke="url(#salon-gold)" strokeWidth="4" filter="url(#salon-recess)"/>
 <rect x="29" y="29" width="302" height="582" rx="127" fill="url(#salon-stitch)" stroke="#93bfac" strokeOpacity=".18"/>
 </svg>
 </div>;}
