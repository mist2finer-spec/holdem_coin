import {NextRequest,NextResponse} from 'next/server';
import {randomBytes} from 'node:crypto';
import path from 'node:path';
import {RpgItemsStore} from '../../../../lib/rpg-items';
import {ACTIVE_CATALOG,GEMS} from '../../../../components/rpg/hunt-build';
export const runtime='nodejs';
const globalItems=globalThis as unknown as {rpgItems?:RpgItemsStore};
function store(){return globalItems.rpgItems??(globalItems.rpgItems=new RpgItemsStore(path.join(process.env.RPG_SAVE_DIR||path.join(process.cwd(),'.data/rpg'),'items.sqlite')));}
export async function POST(req:NextRequest){
 try{const origin=req.headers.get('origin');if(origin&&new URL(origin).host!==req.headers.get('host'))return NextResponse.json({error:'다른 출처 요청은 허용되지 않습니다.'},{status:403});
 const reader=req.body?.getReader();if(!reader)throw Error('Missing body');let length=0;const chunks:Uint8Array[]=[];for(;;){const p=await reader.read();if(p.done)break;length+=p.value.length;if(length>1024){await reader.cancel();throw Error('Request too large');}chunks.push(p.value);}const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
 let account=req.cookies.get('rpg_guest')?.value;if(!account||!/^[a-f0-9]{64}$/.test(account))account=randomBytes(32).toString('hex');let result;
 if(body.action==='view')result={...store().view(account),link:store().link(account)};
 else if(body.action==='transcend'){
 const target=body.target;if(typeof target!=='string'||!(target.startsWith('gear:')||[...ACTIVE_CATALOG,...GEMS].some(g=>`gem:${g.id}`===target)))throw Error('존재하지 않는 초월 대상입니다.');result=store().transcend(account,target,body.requestId,body.revision);
 }else throw Error('Invalid action');
 const response=NextResponse.json(result,{headers:{'Cache-Control':'no-store'}});response.cookies.set('rpg_guest',account,{httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production',path:'/api/rpg',maxAge:31536000});return response;
 }catch(e){return NextResponse.json({error:e instanceof Error&&/[가-힣]/.test(e.message)?e.message:'보관함 요청을 처리하지 못했습니다.'},{status:400});}
}
