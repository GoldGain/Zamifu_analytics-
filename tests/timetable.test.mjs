import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const dir=await mkdtemp(join(tmpdir(),'timetable-test-'));
await build({entryPoints:['src/lib/timetable-csp-solver.ts','src/lib/timetable-generator.ts','src/lib/timetable-validator.ts'],bundle:true,platform:'node',format:'esm',outdir:dir,outExtension:{'.js':'.mjs'}});
const {solveTimetableCsp}=await import(pathToFileURL(join(dir,'timetable-csp-solver.mjs')));
const {validateTimetableRules}=await import(pathToFileURL(join(dir,'timetable-validator.mjs')));
const {isValidDoubleLessonPair,getExactGridAssignmentIssues}=await import(pathToFileURL(join(dir,'timetable-generator.mjs')));
process.on('exit',()=>{rm(dir,{recursive:true,force:true});});
const weekdays=['Monday','Tuesday','Wednesday','Thursday','Friday'];
const times=[['08:20','09:00'],['09:00','09:40'],['09:50','10:30'],['10:30','11:10'],['11:30','12:10'],['12:10','12:50'],['14:00','14:40'],['14:40','15:20']];
function fixture(level, count, n, subjects, teacherFor=(c,s)=>`teacher-${c}`){
 const classes=Array.from({length:count},(_,i)=>({id:`g${i+1}`,name:`Class ${i+1}`}));
 return {schoolId:'regression-test',levelKey:level,classes,allowIncompleteClasses:true,
 lessonSlots:times.slice(0,n).map(([start_time,end_time],i)=>({id:`s${i+1}`,label:`Lesson ${i+1}`,slot_type:'lesson',slot_order:i+1,start_time,end_time})),
 assignments:classes.flatMap((c,ci)=>subjects.map(([name,lessons,double=false])=>({class_id:c.id,subject_id:name,subjects:{name},teacher_id:teacherFor(ci,name),lessons_per_week:lessons,is_double_lesson:double,available_days:weekdays,double_lesson_days:[]})))};
}
function verify(o,r){
 assert.equal(r.issues.length,0,JSON.stringify(r.issues));assert.equal(r.failedClasses.length,0,JSON.stringify(r.failedClasses));assert.equal(r.engine,'csp');
 assert.equal(r.entries.length,o.assignments.reduce((n,a)=>n+a.lessons_per_week,0));
 const busy=new Set();const cells=new Set();
 for(const e of r.entries){let k=`${e.teacher_id}/${e.day_of_week}/${e.time_slot_id}`;assert(!busy.has(k),'teacher conflict '+k);busy.add(k);k=`${e.class_id}/${e.day_of_week}/${e.time_slot_id}`;assert(!cells.has(k),'class conflict '+k);cells.add(k);}
 for(const a of o.assignments){const entries=r.entries.filter(e=>e.class_id===a.class_id&&e.subject_id===a.subject_id);assert.equal(entries.length,a.lessons_per_week);for(const e of entries)assert(a.available_days.includes(weekdays[e.day_of_week-1]));
 const perDay=new Map();for(const e of entries)perDay.set(e.day_of_week,(perDay.get(e.day_of_week)||0)+1);
 for(const [,count] of perDay)assert(count<=2,`${a.subject_id} appears ${count} times in one day (a triple is never allowed)`);
 const pairs=entries.filter(e=>e.entry_type==='lesson_double');const implicit=a.lessons_per_week>a.available_days.length;
 const primarySplit=['lower-primary','upper-primary'].includes(o.levelKey)&&implicit&&!a.is_double_lesson;
 if(primarySplit)assert(pairs.length===0||pairs.length===2,`primary double ${a.subject_id}`);
 else assert.equal(pairs.length,a.is_double_lesson||implicit?2:0,`configured double ${a.subject_id}`);
 if(pairs.length){assert.equal(pairs[0].day_of_week,pairs[1].day_of_week);const s=pairs.map(e=>o.lessonSlots.find(s=>s.id===e.time_slot_id));assert(isValidDoubleLessonPair(a.subjects.name,s[0],s[1]),'split double');}}
 const counts=new Map(o.assignments.map(a=>[`${a.class_id}-${a.subject_id}`,a.lessons_per_week]));
 const short=r.shortClasses.filter(c=>c.configuredTotal<c.expectedTotal).map(c=>c.classId);
 const issues=validateTimetableRules({entries:r.entries,slots:o.lessonSlots,classes:o.classes,subjectNames:new Map(o.assignments.map(a=>[a.subject_id,a.subjects.name])),levelGroup:o.levelKey,requireComplete:true,allowBlankSlotsForClassIds:short,requiredLessonCounts:counts});
 assert.deepEqual(issues,[]);
}
const juniorSubjects=[['English',5],['Kiswahili',4],['CRE',4],['Mathematics',5],['Pre-Technical Studies',4],['Creative Arts',5,true],['Social Studies',4],['Integrated Science',5,true],['Agriculture',4]];
function junior(){return fixture('junior',3,8,juniorSubjects,(c,s)=>s==='Mathematics'||s==='Pre-Technical Studies'?'t2':s==='English'?'t4':s==='Integrated Science'||s==='Agriculture'?'t1':s==='Kiswahili'||s==='CRE'?'t5':c===2?'t4':'t3');}
test('three junior grades: 120 lessons, shared teachers and six unbroken doubles',()=>{const o=junior();const r=solveTimetableCsp(o);verify(o,r);assert.equal(r.entries.length,120);assert.equal(r.entries.filter(e=>e.entry_type==='lesson_double').length,12);});
test('pre-primary: 24 assigned lessons per class, one blank, all configured doubles',()=>{const o=fixture('pre-primary',2,5,[['Mathematical Activities',5],['Language Activities',5],['Environmental Activities',5],['Creative Activities',5,true],['Religious Activities',4]]);verify(o,solveTimetableCsp(o));});
test('lower primary: 28 lessons per class, no invented filler subjects',()=>{const o=fixture('lower-primary',3,6,[['Mathematics',5],['English',5],['Kiswahili',5],['Environmental Activities',5],['Creative Activities',5,true],['CRE',3]]);verify(o,solveTimetableCsp(o));});
test('upper primary: 34 assigned lessons per class with shared teachers',()=>{const o=fixture('upper-primary',3,7,[['Mathematics',5],['English',5],['Kiswahili',4],['Science and Technology',4,true],['Agriculture',4],['Social Studies',4],['CRE',3],['Creative Arts',5,true]],(c,s)=>s==='Mathematics'?'math':s==='English'?'english':`${c}-${s}`);verify(o,solveTimetableCsp(o));});
test('six weekly lessons keep inferred double and all weekly counts',()=>{const o=fixture('lower-primary',1,6,[['Mathematics',6],['English',5],['Kiswahili',5],['Environmental Activities',4],['Creative Activities',5,true],['CRE',3]]);verify(o,solveTimetableCsp(o));});
test('restricted available weekdays are never broadened',()=>{const o=fixture('pre-primary',1,5,[['Language Activities',3,true],['Creative Activities',3]]);o.assignments[0].available_days=['Tuesday','Thursday'];verify(o,solveTimetableCsp(o));});
test('a configured double can never cross a break',()=>{const o=fixture('pre-primary',1,2,[['Creative Activities',2,true]]);o.lessonSlots[1].start_time='09:10';const r=solveTimetableCsp(o);assert.equal(r.entries.length,0);assert(r.issues.length);});
test('reserved teacher cells are respected',()=>{const o=fixture('pre-primary',1,5,[['Language Activities',4],['Creative Activities',4,true]]);o.reservedTeacherCells=new Set(['teacher-0|0|0']);const r=solveTimetableCsp(o);verify(o,r);assert(!r.entries.some(e=>e.day_of_week===1&&e.time_slot_id==='s1'));});
test('genuine teacher overcapacity returns no schedule',()=>{const o=junior();o.assignments.forEach(a=>a.teacher_id='only-teacher');const r=solveTimetableCsp(o);assert.equal(r.entries.length,0);assert(r.issues.length||r.warnings.length);});
test('independent validator rejects double pairs across breaks',()=>{const o=fixture('pre-primary',1,2,[['Creative Activities',2,true]]);o.lessonSlots[1].start_time='09:10';const entries=o.lessonSlots.map(s=>({class_id:'g1',subject_id:'Creative Activities',teacher_id:'t',day_of_week:1,time_slot_id:s.id,entry_type:'lesson_double'}));const issues=validateTimetableRules({entries,slots:o.lessonSlots,subjectNames:{'Creative Activities':'Creative Activities'}});assert(issues.some(i=>i.rule==='once-per-day'));});

test('all junior subjects configured as doubles retain every requested pair',()=>{const o=junior();o.assignments.forEach(a=>a.is_double_lesson=true);const r=solveTimetableCsp(o);verify(o,r);assert.equal(r.entries.filter(e=>e.entry_type==='lesson_double').length,54);});

test('seven learning areas can fill eight daily slots using configured doubles',()=>{const o=fixture('junior',1,8,[['Area A',6,true],['Area B',6,true],['Area C',6,true],['Area D',6,true],['Area E',6,true],['Area F',5],['Area G',5]]);verify(o,solveTimetableCsp(o));});
test('partial cross-level time overlaps reserve every affected lesson',()=>{const o=fixture('pre-primary',1,5,[['Language Activities',4],['Creative Activities',4,true]]);o.reservedTeacherPeriods=[{teacherId:'teacher-0',day:0,startTime:'08:40',endTime:'09:20'}];const r=solveTimetableCsp(o);verify(o,r);assert(!r.entries.some(e=>e.day_of_week===1&&['s1','s2'].includes(e.time_slot_id)));});
test('matching lesson numbers at nonoverlapping times do not block teachers',()=>{const o=fixture('pre-primary',1,1,[['Language Activities',5]]);o.reservedTeacherPeriods=[{teacherId:'teacher-0',day:0,startTime:'09:00',endTime:'09:40'}];verify(o,solveTimetableCsp(o));});
test('fixed activity cells remain free while all assigned lessons are placed',()=>{const o=fixture('pre-primary',1,5,[['Language Activities',5],['Mathematical Activities',5],['Environmental Activities',5],['Creative Activities',5,true],['Religious Activities',4]]);o.blockedClassCells=new Set(['g1|0|2']);const r=solveTimetableCsp(o);verify(o,r);assert(!r.entries.some(e=>e.day_of_week===1&&e.time_slot_id==='s3'));});
test('validator rejects a lesson over a fixed activity',()=>{const o=fixture('pre-primary',1,5,[['Language Activities',1]]);const e={class_id:'g1',day_of_week:1,time_slot_id:'s1',subject_id:'Language Activities',teacher_id:'t',entry_type:'lesson'};const issues=validateTimetableRules({entries:[e,{...e,subject_id:null,teacher_id:null,entry_type:'activity'}],slots:o.lessonSlots,subjectNames:{'Language Activities':'Language Activities'}});assert(issues.some(i=>i.rule==='activity-overlap'));});

test('assignment preflight agrees with inferred double and automatic weekdays',()=>{const o=fixture('lower-primary',1,6,[['Mathematics',6],['Creative Activities',3,true]]);o.assignments[1].available_days=['Tuesday','Thursday'];o.assignments[1].double_lesson_days=['Monday'];assert.deepEqual(getExactGridAssignmentIssues({classes:o.classes,assignments:o.assignments,totalLessons:6}),[]);verify(o,solveTimetableCsp(o));});

test('lower primary: seven Creative Arts lessons fit by teaching it twice on some days',()=>{const o=fixture('lower-primary',3,6,[['Mathematics',5],['English',5],['Kiswahili',5],['Environmental Activities',5],['Creative Activities',7],['CRE',3]]);const r=solveTimetableCsp(o);verify(o,r);for(const c of o.classes){const art=r.entries.filter(e=>e.class_id===c.id&&e.subject_id==='Creative Activities');assert.equal(art.length,7,'every Creative Arts lesson is placed');const perDay={};for(const e of art)perDay[e.day_of_week]=(perDay[e.day_of_week]||0)+1;assert(Object.values(perDay).every(n=>n<=2),'Creative Arts never appears three times in a day');assert(Object.values(perDay).some(n=>n===2),'Creative Arts uses a second appearance on a day');}});
test('upper primary: six-lesson subjects fit by appearing twice on some days',()=>{const o=fixture('upper-primary',3,7,[['Mathematics',6],['English',6],['Kiswahili',5],['Integrated Science',6],['Social Studies',5],['CRE',4],['Agriculture',3]]);const r=solveTimetableCsp(o);verify(o,r);for(const c of o.classes)for(const name of ['Mathematics','English','Integrated Science']){const es=r.entries.filter(e=>e.class_id===c.id&&e.subject_id===name);assert.equal(es.length,6,`${name} places all six lessons`);const perDay={};for(const e of es)perDay[e.day_of_week]=(perDay[e.day_of_week]||0)+1;assert(Object.values(perDay).every(n=>n<=2),`${name} never appears three times in a day`);}});
