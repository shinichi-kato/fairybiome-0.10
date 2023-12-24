import "fake-indexeddb/auto";
import '@vitest/web-worker';
import { scheme } from '../worker/central.core';
import { expect, describe, it,not } from 'vitest';
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
  }
};

describe('central core', () => {
  it('scheme data prapration', async () => {
    const r = await db.saveScheme('test', schemeData);
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


});