// central worker
//
// memory
// {BOT_NAME} : チャットボットの名前
// {BOT_NICKNAMES}: チャットボットのニックネーム配列
// {REQUEST_COUNT}: ユーザがボットに話しかけた
// {CURRENT_COND_TAGS}:  

import { db } from '../../dbio.js';
import { random, pickRandom } from 'mathjs';
import { Message } from '../../message';
import { noder } from './noder';

const RE_PERSISTENT_TAG = /^[A-Z][A-Za-z0-9_]*$/;

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
    minIntensity: 0.1,  // この値よりもスコアが小さい返答は採用しない


  },
  memory: {},
  parts: [],
  partLoadCounter: [],
  innerOutputs: [],
  channel: new BroadcastChannel("biomebot"),

  load: async (botId) => {
    let data = await db.loadScheme(botId);
    if (!data) {
      return false;
    }
    data = data.main;
    let payload = data.payload;
    scheme.botId = botId;
    scheme.schemeName = data.dir;
    scheme.ownerId = data.ownerId;
    scheme.avatarDir = payload.avatarDir;
    scheme.backgroundColor = payload.backgroundColor;
    scheme.interval = {
      ...scheme.interval,
      ...payload.interval,
    };
    scheme.response = { ...payload.response };
    scheme.memory = { ...payload.memory };
    scheme.displayName = scheme.memory["{BOT_NAME}"];
    scheme.channel.onmessage = event => {
      const action = event.data;
      switch (action.type) {
        case 'innerOutput':
          scheme.innerOutputs.push(action);
          break;
        case 'close':
          console.log("closing biomebot channel")
          scheme.channel.close();
          break;

        default:
          /* nop */
      }
    }
    scheme.channel.onmessageerror = event => {
      console.log(event);
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
    console.log("run")
    if (scheme.innerOutputs.length !== 0) {
      // ↓そこそこスコアの高かったものからランダムに選ぶ
      const reply = pickRandom(scheme.innerOutputs)

      const message = new Message('bot', {
        avatarDir: scheme.avatarDir,
        text: reply.text,
        speakerName: scheme.displayName,
        speakerId: scheme.botId,
        backgroundColor: scheme.backgroundColor,
        avatar: reply.avatar
      });

      let cond = {}
      for (let key in reply.pendingCond) {
        if (RE_PERSISTENT_TAG.test(key)) {
          cond[key] = reply.pendingCond[key]
        }
      }


      scheme.channel.postMessage({
        type: 'output', message: message,
        partName: reply.partName,
        cond: cond
      });

      scheme.innerOutputs = [];
    } else if ('{REQUEST_COUNT}' in scheme.memory) {
      const req = scheme.memory['{REQUEST_COUNT}'];
      if (req === 1) {
        // ユーザやボットからなにか言われたが返答していない場合、
        // 無言だったことを内言する。内言しても応答できなかった
        // 場合(req>1)は無理にしゃべらない

        const message = new Message('bot', {
          avatarDir: scheme.avatarDir,
          speakerName: scheme.displayName,
          speakerId: scheme.botId,
          backgroundColor: "",
          avatar: "",
          text: "{?SILENCE}"
        })
        scheme.channel.postMessage({ type: 'input', message: message });
      }
    }

    scheme.memory['{REQUEST_COUNT}']=null;
    return true;

  },

  kill: () => {
    clearTimeout(scheme.interval.timerId);
    scheme.channel.terminate();
  },

  recieve: (message) => {
    if (message.kind !== 'env') {
      if ('{REQUEST_COUNT}' in scheme.memory) {
        scheme.memory["{REQUEST_COUNT}"]++;
      } else {
        scheme.memory["{REQUEST_COUNT}"] = 1;
      }
    }
    scheme.channel.postMessage({ type: 'input', message: message });
  }
}