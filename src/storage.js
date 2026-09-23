const KEY='splashline-racers-v1';
const mobile=/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)||matchMedia('(pointer:coarse)').matches;
export const defaults={graphics:'auto',sensitivity:1,handedness:'left',audio:true,music:false,shadows:!mobile,postprocessing:false,vfx:true,practice:false,palette:0,cosmetic:0,bestTimes:{},unlocks:[0]};
export function readSave(){
  try{const raw=JSON.parse(localStorage.getItem(KEY)||'{}');return {...defaults,...raw,bestTimes:{...defaults.bestTimes,...raw.bestTimes},unlocks:Array.isArray(raw.unlocks)?raw.unlocks:[0]}}
  catch{return {...defaults}}
}
export function writeSave(save){try{localStorage.setItem(KEY,JSON.stringify(save))}catch{}}
