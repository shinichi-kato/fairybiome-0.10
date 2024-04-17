import "fake-indexeddb/auto";
import '@vitest/web-worker';
import { scheme, timer2datetime } from '../worker/central.core';
import { expect, describe, it, not } from 'vitest';
import { db } from '../../dbio.js';

const schemeData = {
  "description": "説明",
  "author": "system",
  "avatarDir": "fairy-girl",
  "backgroundColor": "#de53a1",
  "interval": {
    "max": 5000,
    "min": 1200
  },
  "response": {
    "minIntensity": 0.3
  },
  "memory": {
    "{BOT_NAME}": "ティピカ",
    "{I}": ["私"],
    "{YOU}": ["あなた"],
    "{AWAKENING_HOUR}": 7,
    "{BEDTIME_HOUR}": 21
  },
  "timer": {
    "{ALARM_MONDAY}": { day: "Monday" }
  }
};

describe('central core', () => {
  it('scheme data prapration', async () => {
    const r = await db.saveScheme('test', { main: schemeData });
    expect(r).toBe(true);
  });

  it('load', async () => {
    const r = await scheme.load('test');
    expect(r).toBe(true);
  });

  it('run', async () => {
    const r = scheme.run();
    expect(r).toBe(true);
  });

  it('timer2datetime-nextMonday', () => {
    const nextMonday = timer2datetime({ day: 'Monday' });
    console.log("nextMonday", nextMonday.toLocaleDateString());
    expect(nextMonday.getDay()).toBe(1);
  });

  it('timer2datetime-2024',()=>{
    const now = new Date();
    const today = timer2datetime({year:2024});
    console.log("nextDay", today.toLocaleDateString());
    expect(today.getDate()).toBe(now.getDate());
  })


});