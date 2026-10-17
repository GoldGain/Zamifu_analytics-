import Logic from 'logic-solver';

/** A single variable represents a whole single or double; pairs never split. */
export interface ExactSession {
  index: number;
  classIndex: number;
  family: string;
  teacherIndexes: number[];
  lessons: number;
  window: Uint8Array;
  allowedDayMask: number;
  doubleRequested: boolean;
  autoDouble: boolean;
}
export interface ExactUnit { sessionIndex: number; day: number; slot: number; size: 1 | 2 }
export interface ExactSearchOptions {
  sessions: ExactSession[];
  classCount: number;
  slotsPerDay: number;
  shortClasses: ReadonlySet<number>;
  classFree?: (classIndex: number, day: number, slot: number) => boolean;
  teacherFree: (teacher: number, day: number, slot: number) => boolean;
  pairAllowed: (session: ExactSession, day: number, slot: number) => boolean;
}

/**
 * Solve the entire level together, not independently sampled weekday shapes.
 * Hard constraints: weekly allocations, one appearance per day, requested
 * doubles, real-time pair continuity, teacher availability, class occupancy,
 * subject windows, and Maths/Science separation. Empty cells are allowed only
 * for explicitly accepted short classes. A null model is a proved conflict,
 * not exhaustion of a randomized restart budget.
 */
export function solveExactTimetable(options: ExactSearchOptions): { units: ExactUnit[] | null; variables: number } {
  const {sessions, slotsPerDay, classCount}=options;
  const solver=new Logic.Solver();
  const units: (ExactUnit & { name: string })[]=[];
  const cells: string[][]=Array.from({length:classCount*5*slotsPerDay},()=>[]);
  const teachers=new Map<string,string[]>();
  const maths: string[][]=cells.map(()=>[]);
  const sciences: string[][]=cells.map(()=>[]);
  const cellIndex=(c:number,d:number,s:number)=>(c*5+d)*slotsPerDay+s;
  const pushTeacher=(key:string,name:string)=>{const values=teachers.get(key)||[];values.push(name);teachers.set(key,values);};

  for(const session of sessions){
    const names:string[]=[],weights:number[]=[],doubles:string[]=[];
    const needsDouble=session.doubleRequested||session.autoDouble;
    for(let day=0;day<5;day++){
      if(!(session.allowedDayMask & (1<<day)))continue;
      const appearances:string[]=[];
      for(let slot=0;slot<slotsPerDay;slot++){
        for(const size of [1,2] as const){
          if(size===2 && (!needsDouble||session.lessons<2||slot+1>=slotsPerDay||!options.pairAllowed(session,day,slot)))continue;
          if(size===1 && needsDouble && session.lessons===2)continue;
          let legal=true;
          for(let offset=0;offset<size;offset++){
            if(!session.window[slot+offset]
              || options.classFree?.(session.classIndex,day,slot+offset) === false
              || session.teacherIndexes.some(t=>!options.teacherFree(t,day,slot+offset)))legal=false;
          }
          if(!legal)continue;
          const name=`u${units.length}`;
          units.push({sessionIndex:session.index,day,slot,size,name});
          names.push(name);weights.push(size);appearances.push(name);
          if(size===2)doubles.push(name);
          for(let offset=0;offset<size;offset++){
            const cell=cellIndex(session.classIndex,day,slot+offset);
            cells[cell].push(name);
            if(session.family==='math')maths[cell].push(name);
            if(session.family==='science')sciences[cell].push(name);
            for(const teacher of session.teacherIndexes)pushTeacher(`${teacher}|${day}|${slot+offset}`,name);
          }
        }
      }
      if(appearances.length>1)solver.require(Logic.atMostOne(appearances));
    }
    solver.require(Logic.equalBits(Logic.weightedSum(names,weights),Logic.constantBits(session.lessons)));
    if(needsDouble&&session.lessons>=2)solver.require(Logic.exactlyOne(doubles));
  }
  for(let c=0;c<classCount;c++)for(let day=0;day<5;day++)for(let slot=0;slot<slotsPerDay;slot++){
    const idx=cellIndex(c,day,slot);
    solver.require(options.shortClasses.has(c)?Logic.atMostOne(cells[idx]):Logic.exactlyOne(cells[idx]));
    if(slot+1<slotsPerDay){
      const next=idx+1;
      if(maths[idx].length&&sciences[next].length)solver.forbid(Logic.and(Logic.or(maths[idx]),Logic.or(sciences[next])));
      if(sciences[idx].length&&maths[next].length)solver.forbid(Logic.and(Logic.or(sciences[idx]),Logic.or(maths[next])));
    }
  }
  for(const values of teachers.values())if(values.length>1)solver.require(Logic.atMostOne(values));
  const solution=solver.solve();
  if(!solution)return {units:null,variables:units.length};
  const chosen=new Set(solution.getTrueVars());
  return {units:units.filter(u=>chosen.has(u.name)).map(({name,...unit})=>unit),variables:units.length};
}
