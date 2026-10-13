import type { GeneratedExamQuestion } from './exam-schema.js';
const normalized=(value:string)=>String(value||'').replace(/\s+/g,' ').trim().toLowerCase();
/** Preserve the stimulus, removing a repeated lettered question block only when every supplied part matches it. */
export function questionDisplayStem(question:GeneratedExamQuestion):string {
 let text=String(question.question_text||'').trim();const parts=question.sub_parts||[];
 if(parts.length&&parts.every(part=>normalized(part.prompt).length>=8&&normalized(text).includes(normalized(part.prompt)))){
  const first=parts[0];const index=text.indexOf(first.prompt.trim());
  if(index>=0){const lineStart=text.lastIndexOf('\n',index)+1;const prefix=text.slice(lineStart,index).trim();const label=String(first.label||'').replace(/[^a-z0-9]/gi,'');
   if(label&&prefix.replace(/[^a-z0-9]/gi,'').toLowerCase()===label.toLowerCase())text=text.slice(0,lineStart).trim();
  }
 }
 const escaped=String(question.marks).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const repeatedMarks=new RegExp(`\\s*(?:\\[\\s*${escaped}\\s*marks?\\s*\\]|\\(\\s*(?:alama\\s+${escaped}|${escaped}\\s+marks?)\\s*\\))\\s*$`,'i');
 return text.replace(repeatedMarks,'').trim();
}
