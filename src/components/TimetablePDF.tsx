import React from 'react';
import { formatTimeDisplay } from '@/lib/timetable-generator';

interface SchoolClass {
  id: string;
  name: string;
  level: number;
  stream?: string | null;
}

interface TimetableEntry {
  id: string;
  class_id: string;
  day_of_week: number;
  time_slot_id: string;
  teacher_id: string | null;
  subject_id: string | null;
  entry_type: 'lesson' | 'break' | 'lunch' | 'activities' | 'activity';
  activity_name: string | null;
  teacher_number?: number;
  subject_name?: string;
  subject_code?: string;
}

interface TimeSlot {
  id: string;
  slot_order: number;
  start_time: string;
  end_time: string;
  slot_type: 'lesson' | 'break' | 'lunch' | 'activities';
  label: string;
}

interface TimetableConfig {
  activities?: Record<string, string>;
}

interface TeacherKeyEntry {
  teacher_number: number;
  teacher_name: string;
  subjects: string[];
}

interface TimetablePDFProps {
  schoolName: string;
  classes: SchoolClass[];
  timeSlots: TimeSlot[];
  entries: TimetableEntry[];
  teacherKey: TeacherKeyEntry[];
  config: TimetableConfig | null;
}

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const SUBJECT_CODE_MAP: Record<string, string> = {
  Mathematics: 'MATH',
  Math: 'MATH',
  English: 'ENG',
  Kiswahili: 'KISW',
  'Integrated Science': 'INTSC',
  Science: 'SC',
  'Social Studies': 'SST',
  CRE: 'CRE',
  'Christian Religious Education': 'CRE',
  Agriculture: 'AGN',
  'Pre-Technical': 'PRET',
  'Pre Technical': 'PRET',
  'Creative Arts': 'CAS',
};

const getSubjectCode = (name: string, code: string): string => {
  const normalizedName = (name || '').trim().toLowerCase();
  const mappedByName = Object.entries(SUBJECT_CODE_MAP).find(([key]) => normalizedName.includes(key.toLowerCase()));
  if (mappedByName) return mappedByName[1];
  const cleanCode = (code || '').trim().toUpperCase();
  if (cleanCode) {
    if (cleanCode.startsWith('MAT') || cleanCode === 'MA') return 'MATH';
    if (cleanCode.startsWith('ENG') || cleanCode === 'ELA') return 'ENG';
    if (cleanCode.startsWith('KIS') || cleanCode === 'KLA') return 'KISW';
    if (cleanCode.startsWith('INTSCI') || cleanCode.startsWith('ISC')) return 'INTSC';
    if (cleanCode.startsWith('SS')) return 'SST';
    if (cleanCode.startsWith('AGR')) return 'AGN';
    if (cleanCode.startsWith('PRE') || cleanCode.startsWith('PTS')) return 'PRET';
    if (cleanCode.startsWith('CAS') || cleanCode.startsWith('CA')) return 'CAS';
    return cleanCode.replace(/\d+/g, '').substring(0, 5) || cleanCode.substring(0, 5);
  }
  return name.replace(/[^A-Za-z]/g, '').substring(0, 5).toUpperCase() || 'SUB';
};

const displayClassName = (cls: SchoolClass): string => {
  const name = cls.name?.replace(/^grade\s*/i, '').trim() || String(cls.level);
  return name.toUpperCase();
};

/**
 * TimetablePDF - A printable/print-optimized timetable view for PDF export
 * Renders the exact same structure as TimetableView but optimized for print output
 */
const TimetablePDF: React.FC<TimetablePDFProps> = ({
  schoolName,
  classes,
  timeSlots,
  entries,
  teacherKey,
  config,
}) => {
  const entryLookup = React.useMemo(() => {
    const lookup = new Map<string, TimetableEntry>();
    entries.forEach((entry) => lookup.set(`${entry.day_of_week}-${entry.class_id}-${entry.time_slot_id}`, entry));
    return lookup;
  }, [entries]);

  const getEntry = (day: number, classId: string, slotId: string) => entryLookup.get(`${day}-${classId}-${slotId}`);

  const getCellContent = (entry: TimetableEntry | undefined, slot: TimeSlot): React.ReactNode => {
    if (slot.slot_type === 'break') {
      const breakLabel = slot.label?.toUpperCase().includes('SECOND') ? 'SECOND BREAK' : 'FIRST BREAK';
      return (
        <span style={{
          writingMode: 'vertical-rl',
          textOrientation: 'mixed',
          transform: 'rotate(180deg)',
          color: '#3b82f6',
          fontWeight: 900,
          letterSpacing: '0.35em',
          fontSize: '1.125rem',
          display: 'inline-block',
        }}>
          {breakLabel}
        </span>
      );
    }
    if (slot.slot_type === 'lunch') {
      return (
        <span style={{
          writingMode: 'vertical-rl',
          textOrientation: 'mixed',
          transform: 'rotate(180deg)',
          color: '#3b82f6',
          fontWeight: 900,
          letterSpacing: '0.35em',
          fontSize: '1.125rem',
          display: 'inline-block',
        }}>
          LUNCH
        </span>
      );
    }
    if (!entry) return <span style={{ color: '#9ca3af' }}>&mdash;</span>;
    if (entry.entry_type === 'activity' || entry.entry_type === 'activities') {
      return <span style={{ color: '#059669', fontWeight: 800, fontSize: '0.875rem' }}>{entry.activity_name}</span>;
    }
    if (!entry.subject_code && !entry.subject_name) return <span style={{ color: '#9ca3af' }}>&mdash;</span>;
    const code = getSubjectCode(entry.subject_name || '', entry.subject_code || '');
    const teacherNumDisplay = entry.teacher_number ? `T${String(entry.teacher_number).padStart(2, '0')}` : '';
    return (
      <span style={{ display: 'inline-flex', alignItems: 'baseline', justifyContent: 'center', gap: '2px', whiteSpace: 'nowrap', fontWeight: 800, letterSpacing: '-0.025em', color: '#1f2937' }}>
        <span>{code}</span>
        {teacherNumDisplay ? <span style={{ color: '#3b82f6' }}>{teacherNumDisplay}</span> : null}
      </span>
    );
  };

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', background: 'white', maxWidth: '100%' }}>
      {/* Header */}
      <div style={{ background: '#f9fafb', borderBottom: '4px solid #e5e7eb', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0, color: '#1f2937' }}>
            {(schoolName || 'School').toUpperCase()} Weekly Timetable
          </h2>
          <p style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '4px 0 0 0' }}>
            Lesson 1&2 → FIRST BREAK → Lesson 3&4 → SECOND BREAK → Lesson 5&6 → LUNCH → Lesson 7&8 → ACTIVITIES
          </p>
        </div>
        <p style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 700, margin: 0 }}>
          {new Date().toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Timetable Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', minWidth: '900px' }}>
          <thead>
            <tr style={{ background: '#f3f4f6', borderBottom: '2px solid #d1d5db' }}>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: 900, color: '#374151', borderRight: '2px solid #d1d5db', width: '96px' }}>TIME</th>
              {classes.map((cls) => (
                <th key={cls.id} style={{ padding: '8px', textAlign: 'center', fontWeight: 900, color: '#374151', borderRight: '1px solid #e5e7eb', minWidth: '60px' }}>
                  {displayClassName(cls)}
                  {cls.stream && <span style={{ display: 'block', color: '#9ca3af', fontWeight: 400 }}>{cls.stream}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map((day, dayIdx) => (
              <React.Fragment key={day}>
                {/* Day header */}
                <tr style={{ background: '#2563eb', color: 'white' }}>
                  <td colSpan={classes.length + 1} style={{ padding: '6px 12px', fontWeight: 900, fontSize: '0.875rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    {DAY_NAMES[dayIdx]}
                  </td>
                </tr>
                {/* Time slots */}
                {timeSlots.map((slot) => {
                  const isBreak = slot.slot_type === 'break';
                  const isLunch = slot.slot_type === 'lunch';
                  const isActivities = slot.slot_type === 'activities';
                  const isFixed = isBreak || isLunch || isActivities;
                  return (
                    <tr
                      key={slot.id}
                      style={{
                        borderBottom: '1px solid #f3f4f6',
                        background: isBreak ? '#eff6ff' : isLunch ? '#fffbeb' : isActivities ? '#ecfdf5' : 'white',
                      }}
                    >
                      <td style={{ padding: '8px 12px', fontWeight: 600, color: '#4b5563', borderRight: '2px solid #d1d5db', whiteSpace: 'nowrap' }}>
                        <div>{formatTimeDisplay(slot.start_time)}</div>
                        <div style={{ color: '#9ca3af' }}>–{formatTimeDisplay(slot.end_time)}</div>
                        {isFixed && (
                          <div style={{
                            fontSize: '10px',
                            fontWeight: 900,
                            marginTop: '2px',
                            color: isBreak ? '#2563eb' : isLunch ? '#d97706' : '#059669',
                          }}>
                            {slot.label}
                          </div>
                        )}
                      </td>
                      {isFixed ? (
                        <td
                          colSpan={classes.length}
                          style={{
                            textAlign: 'center',
                            fontWeight: 900,
                            fontSize: '0.875rem',
                            padding: '8px',
                            color: isBreak ? '#2563eb' : isLunch ? '#b45309' : '#059669',
                          }}
                        >
                          {isActivities
                            ? (config?.activities?.[dayIdx + 1] || config?.activities?.[String(dayIdx + 1)] || slot.label)
                            : slot.label
                          }
                        </td>
                      ) : (
                        classes.map((cls) => {
                          const entry = getEntry(dayIdx + 1, cls.id, slot.id);
                          return (
                            <td key={cls.id} style={{ padding: '8px', textAlign: 'center', borderRight: '1px solid #f3f4f6' }}>
                              {getCellContent(entry, slot)}
                            </td>
                          );
                        })
                      )}
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Teacher Key */}
      {teacherKey.length > 0 && (
        <div style={{ borderTop: '4px solid #e5e7eb', padding: '16px', background: '#f9fafb' }}>
          <h3 style={{ fontWeight: 900, color: '#374151', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Teacher Key</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            {teacherKey.map((teacher) => (
              <div key={teacher.teacher_number} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem' }}>
                <span style={{ fontWeight: 900, color: '#2563eb' }}>T{String(teacher.teacher_number).padStart(2, '0')}</span>
                <span style={{ color: '#4b5563' }}>{teacher.teacher_name}</span>
                {teacher.subjects.length > 0 && (
                  <span style={{ color: '#9ca3af' }}>({teacher.subjects.join(', ')})</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ borderTop: '2px solid #e5e7eb', padding: '12px 20px', textAlign: 'center', fontSize: '0.625rem', color: '#9ca3af' }}>
        <p style={{ margin: 0 }}>Generated by Zamifu Analytics · {schoolName || 'School'} · {new Date().toLocaleDateString('en-KE')}</p>
      </div>
    </div>
  );
};

export default TimetablePDF;
