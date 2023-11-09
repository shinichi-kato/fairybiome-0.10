// central worker
import { db } from '../../dbio.js';

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
    this.interval = { max: 3000, min: 800 };
    this.response = { minIntensity: 0 };
    this.memory = {};

    this.parts = [];
    this.channel = new BroadcastChannel("chat-channel")
    this.partLoadCounter = [];
    console.log("scheme constructed")
  }

  async load(botId) {
    // dexie上に指定されたidのcentralのデータがあればロードし
    // 同じidのpartについてそれぞれPartWorkerにロードさせる。
    // すべて成功したら {type: 'loaded'}をポスト。
    // ロードに失敗したら {type:'not_found'}をポスト

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
    this.intervel = { ...data.interval };
    this.response = { ...data.response };
    this.memory = { ...data.memory };

    this.displayName = this.memory["{BOT_NAME}"]

  }
}

const scheme = new Scheme();

onmessage = function (event) {
  const action = event.data;
  const botId = action.botId;
  switch (action.type) {
    case 'deploy': {
      // dbからロードし、行列計算
      (async ()=>{ 
        scheme.load(botId); 
        postMessage({
          type:'centralLoaded',
          avatarDir: this.avatarDir,
          backgroundColor: this.backgroundColor,
          displayName: this.displayName,
        });

        // postMessage({type:'centralDeployed'});
      })();
      break;
    }

    default:
      throw new Error(`central: invalid action ${action.type}`);
  }
}