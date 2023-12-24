// central worker
import { db } from '../../dbio.js';
import { random, pickRandom } from 'mathjs';
import { Message } from '../../message';
import { noder } from './noder';

export const scheme = {
  botId: null,
  ownerId: null,
  schemeName: null,
  avatarDir: null,
  backgroundColor: "",
  interval: {
    max: 3000,
    min: 800,
    timerId: null,
  },
  response: {
    minIntensity: 0.1
  },
  memory: {},
  parts: [],
  partLoadCounter: [],
  innerOutputs: [],
  channel: new BroadcastChannel("biomebot"),

  load: async (botId) => {
    const data = await db.loadScheme(botId);
    if (!data) {
      return false;
    }
    scheme.schemeName = data.schemeName;
    scheme.ownerId = data.ownerId;
    scheme.avatarDir = data.avatarDir;
    scheme.backgroundColor = data.backgroundColor;
    scheme.interval = {
      ...data.interval,
      timerId: null,
    };
    scheme.response = { ...data.response };
    scheme.memory = { ...data.memory };
    scheme.displayName = scheme.memory["{BOT_NAME}"];
    scheme.channel.onmessage = event => {
      const action = event.data;
      if (action.type === 'innerOutput') {
        scheme.innerOutputs.push(action);
      }
    }
    noder.load(scheme.memory);


    return true;
  },

  run: () => {
    // intervalで定義されるランダムな間隔でrun()は実行され、
    // innerOutputを集約して返答する
    // scheme.innerOutputには以下の内容が格納される
    // {
    //   type: 'innerOutput',
    //   partName: part.partName,
    //   text: rndr.text,
    //   score: retr.score,
    //   avatar: rndr.avatar,
    // }

    if (scheme.innerOutputs.length !== 0) {
      const reply = pickRandom(scheme.innerOutputs)

      const message = new Message('bot', {
        avatarDir: scheme.avatarDir,
        text: reply.text,
        speakerName: scheme.displayName,
        speakerId: scheme.botId,
        backgroundColor: scheme.backgroundColor,
        avatar: reply.avatar
      });

      scheme.innerOutputs = [];
    }

    scheme.interval.timerId = setTimeout(
      () => scheme.run(),
      random(scheme.interval.min, scheme.interval.max)
    );

    return true;
  },

  kill: () => {
    clearTimeout(scheme.interval.timerId);
  },

  recieve: (message) => {
    scheme.channel.postMessage({ type: 'input', message: message });
  }
}