import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { getKjseaPaperSpec, makeKjseaBlueprint } from '../src/lib/kjsea-paper-formats.js';
import { getKpseaPaperSpec, makeKpseaBlueprint, assessmentLevelForGrade } from '../src/lib/exam-grade-policy.js';
import { supportsTwoPapers } from '../src/lib/exam-construction.js';
import { makeBalancedBlueprint, type ExamGenerationRequest, type CurriculumScopeNode } from '../src/lib/exam-schema.js';
import { getExamBlueprintSlots } from '../src/lib/exam-generation-contract.js';
import { validateGeneratedExam } from '../src/lib/exam-validation.js';

/** This runner tests the LIVE app, not a substitute local model or a synthetic response. */
const root=path.resolve(process.env.ZAMIFU_EVIDENCE_DIR || '/home/ubuntu/zamifu-validation');
const input=process.env.ZAMIFU_CURRICULUM_MATRIX || path.join(root,'curriculum-matrix.json');
const mode=process.argv[2] || 'prepare';
const only=new Set(process.argv.slice(3));
const workers=Math.max(1,Math.min(3,Number(process.env.ZAMIFU_TEST_WORKERS || 2)));
for(const dir of ['requests','responses','errors'])fs.mkdirSync(path.join(root,dir),{recursive:true});
const clientSource=fs.readFileSync(path.resolve('src/lib/supabase/client.ts'),'utf8');
const anon=process.env.ZAMIFU_SUPABASE_ANON_KEY || clientSource.match(/supabaseAnonKey[^\n]+\|\|\s*'([^']+)'/)?.[1];
const supabaseUrl=process.env.ZAMIFU_SUPABASE_URL || 'https://naihzzlszvrkxrxogsuz.supabase.co';
if(!anon)throw new Error('Public Supabase anonymous key is unavailable.');
type Row={grade_number:number;subject_name:string;subject_id:string;scope:CurriculumScopeNode[]};
type Item={key:string;request:ExamGenerationRequest;priority:number};
const rows=JSON.parse(fs.readFileSync(input,'utf8')) as Row[];
const slug=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const priorityKeys=['g9-integrated-science-paper1','g9-integrated-science-paper2','g9-kiswahili-paper1','g9-kiswahili-paper2','g9-english-paper1','g9-english-paper2','g9-social-studies-single'];
function itemFor(row:Row,variant:'single'|'paper1'|'paper2',subject=row.subject_name,scope=row.scope):Item {
  const key=`g${row.grade_number}-${slug(subject)}-${variant}`;
  const kjsea=row.grade_number===9?getKjseaPaperSpec(subject,variant):null;
  const kpsea=row.grade_number===6?getKpseaPaperSpec(subject):null;
  const format=kjsea?'kjsea':kpsea?'kpsea':'cbe';
  const marks=kjsea?.marks || kpsea?.marks || (scope.length>20?100:70);
  const minutes=kjsea?.duration_minutes ?? kpsea?.duration_minutes ?? (scope.length>20?120:90);
  const blueprint=kjsea?makeKjseaBlueprint(subject,variant):kpsea?makeKpseaBlueprint(subject):makeBalancedBlueprint(['multiple_choice','case_study'],marks);
  const includeImages=/science|biology|chemistry|physics|geography|social studies|mathematics|pre.?technical|aviation|electricity|building|metalwork|mechanics|arts|agriculture|home science/i.test(subject);
  const request:ExamGenerationRequest={title:`${subject} Grade ${row.grade_number} — ${format.toUpperCase()} ${variant==='single'?'School Practice':variant==='paper1'?'Paper 1':'Paper 2'} [Validation October 2026]`,gradeLevel:`Grade ${row.grade_number}`,subject,strands:scope.map(x=>x.strand),subStrands:scope.flatMap(x=>x.subStrands),topics:[],curriculumScope:scope,questionTypes:Array.from(new Set(blueprint?.sections.map(x=>x.question_type)||['multiple_choice','case_study'])),totalMarks:marks,durationMinutes:minutes,difficulty:'mixed',includeImages,includeMarkingScheme:true,format,paperVariant:variant,term:'Term 3',schoolName:'DEMO SCHOOL',level:assessmentLevelForGrade(row.grade_number),preset:'full_paper',blueprint:blueprint || undefined};
  const position=priorityKeys.indexOf(key);
  const priority=position>=0?position:row.grade_number===6?10:row.grade_number===7?20:row.grade_number===8?30:row.grade_number===10&&/Core Mathematics|English|Geography|Physics|Biology/.test(subject)?40:50;
  return{key,request,priority};
}
const manifest=rows.flatMap(row=>(row.grade_number===9&&supportsTwoPapers(row.subject_name)?['paper1','paper2'] as const:['single'] as const).map(variant=>itemFor(row,variant)));
for(const subject of ['Integrated Science','Creative Arts & Social Studies']){
 const spec=getKpseaPaperSpec(subject)!;
 const members=spec.components.map(component=>rows.find(row=>row.grade_number===6&&component.subjects.includes(row.subject_name)));
 if(members.some(row=>!row))continue;
 const scope:CurriculumScopeNode[]=[];
 for(const row of members){for(const node of row!.scope){const existing=scope.find(x=>x.strand===node.strand);if(existing)existing.subStrands=Array.from(new Set([...existing.subStrands,...node.subStrands]));else scope.push({...node,subStrands:[...node.subStrands]});}}
 manifest.push(itemFor(members[0]!,'single',subject,scope));
}
manifest.sort((a,b)=>a.priority-b.priority||a.key.localeCompare(b.key));
fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify(manifest,null,2));
for(const item of manifest)if(!fs.existsSync(path.join(root,'responses',`${item.key}.json`)))fs.writeFileSync(path.join(root,'requests',`${item.key}.json`),JSON.stringify(item.request,null,2),{mode:0o600});
console.log(`Prepared ${manifest.length} source-backed live-paper requests across Grades 6–10.`);
if(mode==='prepare')process.exit(0);
if(!process.env.VERCEL_TOKEN)throw new Error('Use the authorized VERCEL_TOKEN environment variable; do not embed it in this script.');
let auth:{token:string;userId:string;schoolId:string;expires:number};
async function rest(table:string,params:Record<string,string>):Promise<any[]> {
 const url=new URL(`${supabaseUrl}/rest/v1/${table}`);for(const[key,value]of Object.entries(params))url.searchParams.set(key,value);
 const response=await fetch(url,{headers:{apikey:anon!,Authorization:`Bearer ${auth.token}`},signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw new Error(`Bounded demo-data read failed: ${table} HTTP ${response.status}`);
 return response.json();
}
async function authenticate(){
 const response=await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:anon!,'content-type':'application/json'},body:JSON.stringify({email:process.env.ZAMIFU_DEMO_EMAIL||'demo.schooladmin@zamifu.co.ke',password:process.env.ZAMIFU_DEMO_PASSWORD||'Demo@2025'}),signal:AbortSignal.timeout(30000)});
 const data=await response.json();if(!response.ok||!data.access_token)throw new Error(`Public demo authentication failed: HTTP ${response.status}`);
 auth={token:data.access_token,userId:data.user.id,schoolId:'',expires:Date.now()+Number(data.expires_in||3600)*1000};
 const profile=(await rest('profiles',{select:'id,role,school_id',id:`eq.${auth.userId}`,limit:'1'}))[0];
 if(profile?.role!=='school_admin'||!profile.school_id)throw new Error('Demo account is not a school admin.');auth.schoolId=profile.school_id;
 console.log('Authenticated public Demo School administrator.');
}
async function savedPaper(id:string){
 const paper=(await rest('exam_papers',{select:'id,title,grade_level,subject,term,year,duration_minutes,total_marks,format,instructions,marking_scheme,blueprint,source_summary,validation_results,created_at,status',id:`eq.${id}`,school_id:`eq.${auth.schoolId}`,limit:'1'}))[0];
 if(!paper)return null;
 const questions=await rest('exam_paper_question_snapshots',{select:'question_order,payload',paper_id:`eq.${id}`,order:'question_order.asc',limit:'200'});
 return{paper:{...paper,school_name:'DEMO SCHOOL',instructions:String(paper.instructions||'').split(/\r?\n/).filter(Boolean),paper_variant:paper.blueprint?.paper_variant||'single',questions:questions.map(row=>({...row.payload,question_number:row.question_order}))},sourceSummary:paper.source_summary||[]};
}
async function findJob(item:Item,started:string){
 const jobs=await rest('exam_generation_jobs',{select:'id,status,result_paper_id,error_message,request_payload',created_by:`eq.${auth.userId}`,created_at:`gte.${started}`,order:'created_at.desc',limit:'10'});
 return jobs.find(row=>row.request_payload?.title===item.request.title);
}
function curl(item:Item):Promise<{status:number|null;body:any;stderr:string}> {
 return new Promise((resolve,reject)=>{
  const args=['--yes','vercel@latest','curl','https://zamifu.company/api/generate-exam','--yes','--','--silent','--show-error','--max-time','315','--request','POST','--header','Content-Type: application/json','--header',`Authorization: Bearer ${auth.token}`,'--data-binary',`@${path.join(root,'requests',`${item.key}.json`)}`,'--write-out','\nHTTP_STATUS:%{http_code}\n'];
  const child=spawn('npx',args,{cwd:process.cwd(),env:process.env,stdio:['ignore','pipe','pipe']});let out='',err='';
  child.stdout.on('data',data=>out+=data);child.stderr.on('data',data=>err+=data);
  child.on('error',reject);child.on('close',()=>{const match=out.match(/\nHTTP_STATUS:(\d{3})\s*$/);const status=match?Number(match[1]):null;const raw=match?out.slice(0,match.index).trim():out.trim();let body;try{body=JSON.parse(raw);}catch{body={error:`Non-JSON live response HTTP ${status??'unknown'}`};}resolve({status,body,stderr:err.slice(-1200)});});
 });
}
const records:any[]=fs.existsSync(path.join(root,'generation-summary.json'))?JSON.parse(fs.readFileSync(path.join(root,'generation-summary.json'),'utf8')):[];
await authenticate();
for(const row of records){
 const responsePath=path.join(root,'responses',`${row.key}.json`),requestPath=path.join(root,'requests',`${row.key}.json`);
 if(!fs.existsSync(responsePath)||!fs.existsSync(requestPath))continue;
 const payload=JSON.parse(fs.readFileSync(responsePath,'utf8')),effective=JSON.parse(fs.readFileSync(requestPath,'utf8'));
 if(!payload.paper?.marking_scheme&&row.paperId){const stored=await savedPaper(row.paperId);if(stored)payload.paper.marking_scheme=stored.paper.marking_scheme;}
 const currentValidation=payload.paper?.questions?.length?validateGeneratedExam(effective,payload.paper.questions):null;
 const valid=currentValidation?.passed&&payload.paper.questions.length===getExamBlueprintSlots(effective).length&&payload.paper.questions.reduce((sum:number,q:any)=>sum+q.marks,0)===effective.totalMarks&&Boolean(payload.paper.marking_scheme?.length);
 if(valid){row.success=true;row.error=null;row.criticalIssues=[];row.paperId=payload.paper.id;row.questionCount=payload.paper.questions.length;row.totalMarks=payload.paper.questions.reduce((sum:number,q:any)=>sum+q.marks,0);fs.writeFileSync(responsePath,JSON.stringify(payload,null,2),{mode:0o600});}
 else {row.success=false;row.criticalIssues=currentValidation?.issues.filter(issue=>issue.severity==='critical')||[];row.error=row.criticalIssues.map((issue:any)=>issue.message).join('; ')||'The saved draft no longer passes the current complete-paper validation.';}
}
fs.writeFileSync(path.join(root,'generation-summary.json'),JSON.stringify(records,null,2));
const done=new Set(records.filter(row=>row.success).map(row=>row.key));
const selected=manifest.filter(item=>!done.has(item.key)&&(!only.size||only.has(item.key))&&(mode!=='seven'||priorityKeys.includes(item.key)));
console.log(`LIVE ${mode}: ${selected.length} remaining requests, workers=${workers}. No previous successful paper will be duplicated.`);
const wait=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
let completed=0,index=0,fatal=false,consecutiveFailures=0;const active=new Set<string>();const startedRun=Date.now();
const heartbeat=setInterval(()=>console.log(`Progress: ${completed}/${selected.length}; active=${[...active].join(',')||'none'}; elapsed=${Math.round((Date.now()-startedRun)/1000)}s`),30000);
function save(row:any){const previous=records.findIndex(item=>item.key===row.key);if(previous>=0)records[previous]=row;else records.push(row);fs.writeFileSync(path.join(root,'generation-summary.json'),JSON.stringify(records,null,2));}
async function run(item:Item){
 if(Date.now()>auth.expires-60000)await authenticate();
 active.add(item.key);console.log(`START ${item.key}: ${item.request.totalMarks} ${item.request.format==='kpsea'?'derived points':'marks'}, ${getExamBlueprintSlots(item.request).length} items.`);
 const started=new Date().toISOString();let result=await curl(item);
 for(let retry=0;result.status===429&&retry<5;retry++){const seconds=Math.min(600,Number(result.body.retryAfterSeconds)||60);console.log(`RATE ${item.key}: respecting ${seconds}s retry interval.`);await wait(seconds*1000);result=await curl(item);}
 let job=await findJob(item,started).catch(()=>null);
 if(result.status===0&&!job){await wait(2000);job=await findJob(item,started).catch(()=>null);if(!job){console.log(`TRANSPORT ${item.key}: retrying once because no generation job was created.`);result=await curl(item);job=await findJob(item,started).catch(()=>null);}}
 if(!result.body.paper&&job?.status==='generating'){
  const deadline=Date.now()+180000;
  while(job?.status==='generating'&&Date.now()<deadline){await wait(10000);job=await findJob(item,started);}
 }
 if(!result.body.paper&&job?.status==='ready'&&job.result_paper_id)result.body=await savedPaper(job.result_paper_id);
 if(result.body.paper&&!result.body.paper.marking_scheme){const stored=await savedPaper(result.body.paper.id);if(stored)result.body.paper.marking_scheme=stored.paper.marking_scheme;}
 const effective=job?.request_payload||item.request;
 if(effective)fs.writeFileSync(path.join(root,'requests',`${item.key}.json`),JSON.stringify(effective,null,2),{mode:0o600});
 const paper=result.body?.paper;
 const validation=paper?.questions?.length?validateGeneratedExam(effective,paper.questions):null;
 const sum=paper?.questions?.reduce((n:number,q:any)=>n+q.marks,0)||0;
 const exact=paper?.questions?.length===getExamBlueprintSlots(effective).length&&sum===effective.totalMarks;
 const errors=validation?.issues.filter(issue=>issue.severity==='critical')||[];
 const success=Boolean(paper?.id&&exact&&!errors.length&&paper.marking_scheme?.length);
 const row={key:item.key,success,httpStatus:result.status,paperId:paper?.id||null,grade:item.request.gradeLevel,subject:item.request.subject,format:item.request.format,paperVariant:item.request.paperVariant,questionCount:paper?.questions?.length||0,totalMarks:sum,durationMinutes:paper?.duration_minutes??null,mapCount:paper?.questions?.filter((q:any)=>q.visual_spec?.asset_type==='map').length||0,visualCount:paper?.questions?.filter((q:any)=>q.visual_spec||q.image_url).length||0,error:success?null:job?.error_message||result.body?.error||(!exact?'Exact-count or mark contract failed':errors.map(issue=>issue.message).join('; ')||'Missing saved marking scheme'),criticalIssues:errors,finishedAt:new Date().toISOString(),savedResponse:paper?path.join(root,'responses',`${item.key}.json`):null};
 if(paper)fs.writeFileSync(row.savedResponse!,JSON.stringify(result.body,null,2),{mode:0o600});else fs.writeFileSync(path.join(root,'errors',`${item.key}.json`),JSON.stringify({response:result.body,job,stderr:result.stderr},null,2),{mode:0o600});
 save(row);completed++;active.delete(item.key);console.log(`${success?'PASS':'FAIL'} ${item.key}: ${row.questionCount} questions, ${sum} marks, maps=${row.mapCount}${row.error?`; ${String(row.error).slice(0,300)}`:''}`);
 consecutiveFailures=success?0:consecutiveFailures+1;if(consecutiveFailures>=3){fatal=true;console.log('Paused new requests after three consecutive failures: inspect and fix before more production generation.');}
}
try{await Promise.all(Array.from({length:Math.min(workers,selected.length)},async()=>{while(!fatal){const next=index++;if(next>=selected.length)return;await run(selected[next]);}}));}finally{clearInterval(heartbeat);}
console.log(`LIVE run finished: ${records.filter(row=>row.success).length} validated saved papers; ${records.filter(row=>!row.success).length} failures recorded. Summary: ${path.join(root,'generation-summary.json')}`);
if(records.some(row=>!row.success)||fatal)process.exitCode=1;
