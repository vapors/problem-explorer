import {createContext,useCallback,useContext,useEffect,useMemo,useState, type ReactNode} from 'react';
import {CLASSIC_ENTITIES,TERMINOLOGY_LENSES,resolveEntity,resolveMessage,type EntityKey,type MessageKey,type TerminologyPack} from '../types/terminology';

export const DEFAULT_LENS_ID='classic';
const ID_PATTERN=/^[a-z][a-z0-9_]{0,63}$/;
export function getAvailableLensIds(){return Object.keys(TERMINOLOGY_LENSES);}
/** Allows future permission-aware callers to restrict choices, not backend authorization. */
export function validLensId(id:string,allowed?:readonly string[]):string {
 return ID_PATTERN.test(id)&&!!TERMINOLOGY_LENSES[id]&&(!allowed||allowed.includes(id))?id:DEFAULT_LENS_ID;
}

type ContextValue={
 currentLens:TerminologyPack;
 lensId:string;
 setLens:(id:string)=>void;
 getLabel:(key:EntityKey,form?:'singular'|'plural'|'description')=>string;
 t:(key:MessageKey,vars?:Record<string,string|number>)=>string;
 availableLenses:TerminologyPack[];
};
const TerminologyContext=createContext<ContextValue|null>(null);
export function TerminologyProvider({children,preferenceKey,allowedLensIds}:{children:ReactNode;preferenceKey:string;allowedLensIds?:readonly string[]}) {
 const storageKey=`problem-explorer:lens:${preferenceKey}`;
 const [lensId,setLensId]=useState<string>(()=>{
  try{return validLensId(window.localStorage.getItem(storageKey)||DEFAULT_LENS_ID,allowedLensIds)}catch{return DEFAULT_LENS_ID}
 });
 useEffect(()=>{
  try{setLensId(validLensId(window.localStorage.getItem(storageKey)||DEFAULT_LENS_ID,allowedLensIds))}
  catch{setLensId(DEFAULT_LENS_ID)}
 },[storageKey,allowedLensIds]);
 const setLens=useCallback((id:string)=>setLensId(validLensId(id,allowedLensIds)),[allowedLensIds]);
 useEffect(()=>{try{window.localStorage.setItem(storageKey,lensId)}catch{/* storage disabled */}},[lensId,storageKey]);
 const currentLens=TERMINOLOGY_LENSES[lensId]??TERMINOLOGY_LENSES[DEFAULT_LENS_ID];
 const availableLenses=useMemo(()=>Object.values(TERMINOLOGY_LENSES).filter(lens=>!allowedLensIds||allowedLensIds.includes(lens.id)),[allowedLensIds]);
 const getLabel=useCallback((key:EntityKey,form:'singular'|'plural'|'description'='singular')=>
  (currentLens.entities[key]||CLASSIC_ENTITIES[key])[form],[currentLens]);
 const t=useCallback((key:MessageKey,vars:Record<string,string|number>={})=>resolveMessage(currentLens,key,vars),[currentLens]);
 const value=useMemo(()=>({currentLens,lensId,setLens,getLabel,t,availableLenses}),[currentLens,lensId,setLens,getLabel,t,availableLenses]);
 return <TerminologyContext.Provider value={value}>{children}</TerminologyContext.Provider>;
}
export function useTerminology(){const context=useContext(TerminologyContext);if(!context)throw new Error('useTerminology must be used inside TerminologyProvider');return context;}
