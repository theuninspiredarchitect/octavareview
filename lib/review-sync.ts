import type {RecordItem} from './review-types';

// An in-flight snapshot must not undo a local save, deletion, or failed draft.
// Unrelated remote records still update while the local reviewer is working.
export function reconcileReview(remote:RecordItem[],local:RecordItem[],protectedIds:Set<string>):RecordItem[]{
 const current=new Map(local.map(item=>[item.id,item]));
 const merged:RecordItem[]=[];
 for(const item of remote){
  const existing=current.get(item.id);
  if(protectedIds.has(item.id)){
   if(existing)merged.push(existing);
  }else if(existing&&((existing.version||0)>(item.version||0)||JSON.stringify(existing)===JSON.stringify(item))){
   merged.push(existing);
  }else merged.push(item);
  current.delete(item.id);
 }
 for(const item of current.values())if(protectedIds.has(item.id))merged.push(item);
 return merged.length===local.length&&merged.every((item,i)=>item===local[i])?local:merged;
}
