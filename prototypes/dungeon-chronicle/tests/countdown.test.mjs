import test from 'node:test';
import assert from 'node:assert/strict';
import { AutoChoiceCountdown } from '../dist/countdown.js';

test('countdown expires after exactly five seconds, with no early choice',()=>{let now=0;const c=new AutoChoiceCountdown(()=>now);c.start('a','safe');now=4999;assert.equal(c.snapshot().expired,false);assert.equal(c.snapshot().remaining,1);now=5000;assert.equal(c.snapshot().expired,true);});
test('changing the scheduled option preserves the deadline',()=>{let now=0;const c=new AutoChoiceCountdown(()=>now);c.start('a','safe');now=3000;c.retarget('bold');assert.equal(c.snapshot().target,'bold');assert.equal(c.snapshot().remaining,2000);now=5000;assert.equal(c.snapshot().expired,true);});
test('paused time does not consume the remaining countdown',()=>{let now=0;const c=new AutoChoiceCountdown(()=>now);c.start('a','safe');now=1200;c.pause();now=9000;assert.equal(c.snapshot().remaining,3800);assert.equal(c.snapshot().expired,false);c.resume();now=12799;assert.equal(c.snapshot().expired,false);now=12800;assert.equal(c.snapshot().expired,true);});
test('canceling prevents expiry and a later choice starts its own countdown',()=>{let now=0;const c=new AutoChoiceCountdown(()=>now);c.start('a','safe');now=3000;c.cancel();now=8000;assert.equal(c.snapshot().expired,false);assert.equal(c.snapshot().target,null);c.start('b','work');assert.equal(c.snapshot().remaining,5000);assert.equal(c.snapshot().key,'b');});
