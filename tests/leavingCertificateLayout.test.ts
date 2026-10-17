import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CERTIFICATE_FIELDS, CERTIFICATE_PAGE, CERTIFICATE_CROP, CERTIFICATE_SCALE, CERTIFICATE_ORIGIN, layoutCertificate, measureCertificateLine, certificateX, certificateY } from '../src/lib/leavingCertificateLayout';
const normalize = (s: string) => s.replace(/\s+/g, ' ').trim();
function check(values: Record<string, string>) {
  const result = layoutCertificate(values);
  assert.deepEqual(result.errors, []);
  for (const [key, value] of Object.entries(values)) {
    const lines = result.lines.filter(line => line.key === key);
    assert.equal(normalize(lines.map(line => line.text).join(' ')), normalize(value), `No text lost in ${key}`);
    for (const line of lines) {
      assert.ok(measureCertificateLine(line) <= line.width - 6);
      assert.ok(certificateX(line.x) >= CERTIFICATE_PAGE.margin);
      assert.ok(certificateX(line.x + line.width) <= CERTIFICATE_PAGE.width - CERTIFICATE_PAGE.margin);
      assert.ok(certificateY(line.y) <= CERTIFICATE_PAGE.height - CERTIFICATE_PAGE.margin);
    }
  }
  return result;
}
test('long full learner name wraps without truncation or touching ADM. NO.', () => {
  const r=check({name:'ALEXANDRIA MWANJALA WAMBUI NYAMBURA KIMANI', admission:'A001605974'});
  const name=r.lines.filter(l=>l.key==='name'); assert.equal(name.length,2);
  assert.ok(name.every(l=>l.x+l.width<824));
  assert.ok(r.lines.find(l=>l.key==='admission')!.x>920);
});
test('long comments retain every word inside their allocated rows', () => {
  check({academic:'Demonstrates developing academic ability and a basic understanding of the approved Standard course. The pupil has shown willingness to learn and will benefit from continued practice, encouragement and close guidance in future studies.',
    conduct:'Very good. Demonstrates respect for teachers and fellow learners, accepts responsibility and responds positively to guidance. Works well with others and follows school rules consistently.',
    cocurricular:'Participated in athletics, debate and school clubs, showing teamwork, leadership and commitment to the school community.'});
});
test('dates school name head teacher and standards stay inside blanks',()=>check({dob:'12/03/2012',enrolled:'KENYA NAVY JUNIOR SCHOOL',school:'03/10/2020',standard:'Grade 8',left:'17/10/2026','standard-left':'Grade 8','head-name':'Mellen Nyabuto',issue:'17/10/2026'}));
test('short values use a single original ruled line',()=>{const r=check({name:'ALI ABDALLA',conduct:'Good'});assert.equal(r.lines.length,2);assert.equal(r.lines[0].y,471);});
test('unbounded text is rejected explicitly instead of clipped or spilled',()=>{
  for (const f of CERTIFICATE_FIELDS) { const r=layoutCertificate({[f.key]:'Very long content '.repeat(1000)});assert.equal(r.errors.length,1);assert.equal(r.lines.length,0); }
});
test('unbroken long token retains every character across ruled lines',()=>{const original='ABCDEFGHIJ'.repeat(5); const r=layoutCertificate({name:original});assert.equal(r.errors.length,0);assert.equal(r.lines.map(l=>l.text).join(''),original);});
test('A4 canvas contains a uniform artwork scale and 20mm clear margins',()=>{
  const p=CERTIFICATE_PAGE,c=CERTIFICATE_CROP,s=CERTIFICATE_SCALE,o=CERTIFICATE_ORIGIN;
  assert.ok(Math.abs(p.width*25.4/72-210)<0.01);assert.ok(Math.abs(p.height*25.4/72-297)<0.01);
  assert.ok(o.x>=p.margin);assert.ok(o.y>=p.margin);
  assert.ok(o.x+c.width*s<=p.width-p.margin+0.001);assert.ok(o.y+c.height*s<=p.height-p.margin+0.001);
});
