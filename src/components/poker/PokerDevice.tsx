import type {ReactNode} from 'react';
import './poker-device.css';
/** One portrait game composition; wide screens add the handset bezel only. */
export function PokerDevice({children}:{children:ReactNode}){
 return <div className="poker-device-stage"><div className="poker-device"><div className="poker-device-screen">{children}</div></div></div>;
}
