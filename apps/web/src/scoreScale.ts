/** Normalization for legacy 1–5 persisted concept evaluation records only. */
export function tenPoint(score:number|null|undefined, scoreMax:5|10):number|undefined {
  if(score == null || !Number.isFinite(score) || score<1 || score>scoreMax)return undefined;
  return scoreMax===5?Math.round((1+(score-1)*9/4)*10)/10:score;
}
