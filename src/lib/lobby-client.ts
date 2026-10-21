export const LOBBY_TOKEN_KEY='holdem-lobby-token';
export const SOLO_BALANCE_KEY='holdem-solo-balance';
export function lobbyToken(){let token=localStorage.getItem(LOBBY_TOKEN_KEY);if(!token){token=crypto.randomUUID();localStorage.setItem(LOBBY_TOKEN_KEY,token);}return token;}
export function soloBalance(){const n=Number(localStorage.getItem(SOLO_BALANCE_KEY)??5000);return Number.isSafeInteger(n)&&n>=0?n:5000;}
export function saveSoloBalance(n:number){localStorage.setItem(SOLO_BALANCE_KEY,String(Math.max(0,Math.floor(n))));}
export function pokerSocketOptions(){
 const local=['localhost','127.0.0.1'].includes(window.location.hostname)&&window.location.port==='3000';
 return {host:local?'http://localhost:3003':window.location.origin,
  options:{path:'/socket.io/',transports:['polling'],timeout:10000,...(local?{}:{query:{XTransformPort:'3003'}})}};
}
