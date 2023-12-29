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
      ...scheme.interval,
      ...data.interval,
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
    console.log("run",scheme.interval)
    if (scheme.innerOutputs.length !== 0) {
      console.log("chake")
      const reply = pickRandom(scheme.innerOutputs)
      console.log(reply.text)

      const message = new Message('bot', {
        avatarDir: scheme.avatarDir,
        text: reply.text,
        speakerName: scheme.displayName,
        speakerId: scheme.botId,
        backgroundColor: scheme.backgroundColor,
        avatar: reply.avatar
      });

      scheme.channel.postMessage({type:'output',message:message});

      scheme.innerOutputs = [];
    }
    return true;

  },

  kill: () => {
    clearTimeout(scheme.interval.timerId);
  },

  recieve: (message) => {
    console.log("central.core recieved")
    scheme.channel.postMessage({ type: 'input', message: message });
  }
}