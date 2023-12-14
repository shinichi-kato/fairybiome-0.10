/*
part worker
==================================

*/

import { db } from '../../dbio.js';
import contexualCodecMixin from './contextual-codec-mixin.js';

class Part {
  constructor() {
    this.partName = null;
    this.channel = new BroadcastChannel('biomebot');

    // .jsonの保持
    this.response = {
      minIntensity: 0,  // scoreがこの値以上なら発言する
      retention: 0.4,   // このパートの発言が採用された場合、retentionの確率で
      // 次回のminIntensityが無視される
    }
    this.script = [];

    this.vocab = null;
    this.validAvatars = [];
    this.condVector = null;

    this.channel.onmessage = function (event) {
      const action = event.data;
      const botId = action.botId;
      switch (action.type) {
        case 'input': {
          const retr = this.retrieve(action.message.text);
          if (retr.score > this.response.minIntensity) {
            const rndr = this.render(retr.index);
            
            this.channel.postMessage({
              type: 'innerOutput',
              partName: this.partName,
              text: rndr.text,
              score: retr.score,
              avatar: rndr.avatar,
            })
          }
          break;
        }

        default:
          /* nop */
      }
    }

    console.log("part Constructed")
  }

  async load(botId, partName, validAvatars) {
    if (!await db.partExists(botId, partName)) {
      return false;
    }
    const data = await db.loadPart(botId, partName);
    this.partName = partName;
    this.response = { ...data.response };
    this.script = [...data.script];
    this.validAvatars = [...validAvatars];
    return true;
  }

}

// mixin
// Object.assign(Part.prototype, contexualCodecMixin);

const part = new Part();

onmessage = function (event) {
  const action = event.data;
  const botId = action.botId;
  switch (action.type) {
    case 'deploy': {
      (async () => {
        const result = await part.load(botId, action.partName);
        if (result) {
          this.postMessage({ type: 'partLoaded' });
          part.deploy();
          this.postMessage({ type: 'partDeployed' });
        } else {
          this.postMessage({ type: 'partNotFound' });
        }
      })();
      break;
    }

    default:
      throw new Error(`part: invalid action ${action.type}`);
  }
}