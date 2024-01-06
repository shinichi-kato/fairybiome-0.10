import { describe, expect, it } from 'vitest';
import { noder } from '../worker/noder';
import { Message } from '../../message';

describe("noder", () => {
  const message= new Message('user',{
    text:"しずくは、お兄さんの課題を君に。{+test}",
    tagDict:{"{tag}":1}
  });

  it('load memory', ()=>{
    noder.load({'{BOT_NAME}':'しずく'})

    expect().toBe();
  });

  it(`run(${message.text}`, () => {
    const result = noder.run(message);
    console.log(result);

    expect(result[3].feat).toBe('{2}')
  })
})
