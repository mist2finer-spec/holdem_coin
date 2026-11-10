// Opt-in client study. Source Run clip averageSpeed is evidence for the speed target,
// not a measurement of the original game controller. Gravity/apex/contact are authored.
// User adjustment: reduce the previous run speed by one third. Action travel uses this too.
export const SOURCE_TRAVERSAL = Object.freeze({id:'source-run-v2',run:578.19295*2/3,gravity:981,jumpApex:105});
export type TraversalProfile = typeof SOURCE_TRAVERSAL;
export const jumpDuration=(p:TraversalProfile)=>2*Math.sqrt(2*p.jumpApex/p.gravity);
export const jumpHeight=(p:TraversalProfile,age:number)=>Math.max(0,.5*p.gravity*age*(jumpDuration(p)-age));
export const actionDistance=(p:TraversalProfile,kind:string,duration:number)=>p.run*duration*(kind==='dodge'?1.25:kind==='slide'?1.1:.9);
