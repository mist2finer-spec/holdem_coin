// Raw chips in, never amounts already divided by one thousand.
export function formatCurrency(value:number):string {
 if(!Number.isFinite(value))return '0';
 const n=Math.max(0,Math.floor(value));
 if(n<10000)return n.toLocaleString('en-US');
 const [unit,suffix]=n>=1e9?[1e9,'B']:n>=1e6?[1e6,'M']:[1e3,'K'];
 // Truncate rather than round up to a balance the player does not own.
 return `${(Math.floor(n/unit*10)/10).toLocaleString('en-US',{maximumFractionDigits:1})}${suffix}`;
}
