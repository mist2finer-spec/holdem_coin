import {UnityBossService} from './rpg-unity-boss-service';
import {MountSundayEngine} from './rpg-mount-sunday-engine';
import type {RpgStore} from './rpg-store';
import type {RpgItemsStore} from './rpg-items';
export class MountSundayService extends UnityBossService {constructor(store:RpgStore,items?:RpgItemsStore,now=()=>Date.now(),seed=()=>111){super(store,items,now,seed,s=>new MountSundayEngine(s));}}
