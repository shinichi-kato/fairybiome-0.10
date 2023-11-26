// central worker
import { db } from '../../dbio.js';
import { rand, pickRandom } from 'mathjs';
import { Message } from '../../message';

// import { noder } from './noder.js';

class Scheme {
  constructor() {
    this.botId = null;
    this.schemeName = null;
    this.ownerId = null;
    this.description = null;
    this.updatedAt = null;
    this.author = null;
    this.avatarDir = null;
    this.backgroundColor = "";
    this.interval = { max: 3000, min: 800, timerId: null };
    this.response = { minIntensity: 0 };
    this.memory = {};

    this.parts = [];
    this.partLoadCounter = [];
    this.partSpeeches = [];

    this.channel = new BroadcastChannel("biomebot");
    this.channel.onmessage = function (event) {
      const action = event.data;
      if (action.type === 'partSpeech') {
        this.partSpeeches.push(action.message);
      }
    }

    console.log("scheme constructed")


  }

  async load(botId) {
    // dexie上に指定されたidのcentralのデータがあればロードし
    // BOT_NAMEなどの定数を読み込む

    this.botId = botId;
    const data = await db.loadScheme(this.botId);
    if (!data) {
      postMessage({ type: 'not-found' });
      return;
    }
    this.schemeName = data.schemeName;
    this.ownerId = data.ownerId;
    this.description = data.description;
    this.updatedAt = data.updatedAt;
    this.author = data.author;
    this.avatarDir = data.avatarDir;
    this.backgroundColor = data.backgroundColor;
    this.intervel = {
      ...data.interval,
      timerId: null
    };
    this.response = { ...data.response };
    this.memory = { ...data.memory };

    this.displayName = this.memory["{BOT_NAME}"]

    // noder.loadMemory(this.memory);

    this.run();

  }

  run() {
    if (this.partSpeeches.length !== 0) {
      //this.speechリストの中からひとつを選んbimeチャンネルに流す
      const reply = pickRandom(this.partSpeeches);

      // 出力文字列からタグを除去する(未実装) 

      const message = new Message('bot', {
        avatarDir: this.avatarDir,
        text: reply,
        speakerName: this.displayName,
        speakerId: this.botId,
        backgroundColor: this.backgroundColor,
      })
      this.channel.postMessage({ type: 'botSpeech', message: message });

      this.partSpeeches = [];
    }
    if(this.interval.running){
      this.interval.timerId = setTimeout(() => {
        this.run()}, rand(this.interval.min, this.interval.max)
      );
    }
  }

  kill() {
    // speakを停止
    clearTimeout(this.interval.timerId);
  }

  recieve(message) {
    this.channel.postMessage({ type: 'input', message: message });

  }

}

const scheme = new Scheme();

onmessage = function (event) {
  const action = event.data;
  const botId = action.botId;
  switch (action.type) {
    case 'deploy': {
      // dbからロードし、行列計算
      (async () => {
        await scheme.load(botId);
        postMessage({
          type: 'centralDeployed',
          avatarDir: this.avatarDir,
          backgroundColor: this.backgroundColor,
          displayName: this.displayName,
        });

      })();
      break;
    }
    case 'recieve': {
      scheme.recieve(action.message);
      break;
    }
    case 'kill': {
      scheme.kill();
      break;
    }

    default:
      throw new Error(`central: invalid action ${action.type}`);
  }
}


