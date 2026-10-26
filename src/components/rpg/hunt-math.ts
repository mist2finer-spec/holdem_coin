/** Original midpoint-to-even rounding, including negative half ties. */
export function roundEven(value:number){const floor=Math.floor(value),fraction=value-floor;return fraction===.5?(floor%2===0?floor:floor+1):Math.round(value);}
