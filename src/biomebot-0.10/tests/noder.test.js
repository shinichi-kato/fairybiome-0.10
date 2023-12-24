import { describe, expect, it } from 'vitest'
import { noder } from '../worker/noder';

describe("noder", () => {
  const text="しずくは、お兄さんの課題を君に。{+test}";

  it('load memory', ()=>{
    noder.load({

    })

    expect().toBe();
  });

  it(`run(${text}`, () => {
    noder.load({'{BOT_NAME}':'しずく'})
    const result = noder.run(text);
    console.log(result);

    expect(result[3].feat).toBe('{2}')
  })
})
