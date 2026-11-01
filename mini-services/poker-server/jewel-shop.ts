import {JEWELS_BY_ID} from '../../src/components/rpg/jewel-catalog';
import type {RpgItemsStore} from '../../src/lib/rpg-items';
import type {LobbyLedger} from './lobby-ledger';
/** The existing RPG link is a bearer capability. Never accept a raw account/name from the client. */
export function buyShopJewel(ledger:LobbyLedger,items:RpgItemsStore,socket:string,raw:unknown){
 if(!raw||typeof raw!=='object')throw Error('잘못된 구매 요청입니다.');const p=raw as Record<string,unknown>;
 if(typeof p.jewelId!=='string'||typeof p.requestId!=='string'||!/^[-a-zA-Z0-9]{16,80}$/.test(p.requestId)||p.conqueror!==undefined&&typeof p.conqueror!=='string')throw Error('잘못된 구매 요청입니다.');
 const account=items.resolve(p.link),def=JEWELS_BY_ID.get(p.jewelId);if(!account||!def||!ledger.view(socket))throw Error('보관함과 서버 연결을 확인해 주세요.');
 const grant=()=>items.purchaseJewel(account,def.id,p.requestId as string,p.conqueror as string|undefined);
 // A retry remains valid even when the first purchase used the last coin; verify the original product too.
 const wallet=items.jewelReceipt(account,p.requestId)?(grant(),ledger.view(socket)!):ledger.purchase(socket,def.price,grant);
 return {account:wallet,items:items.view(account),purchased:true};
}
