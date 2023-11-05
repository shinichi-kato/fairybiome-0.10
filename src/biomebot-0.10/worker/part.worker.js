import { db } from '../../dbio.js';

class Part {
  constructor() {
    this.encoder = null;
    this.decoder = null;
    this.avatar = null;
    this.response = { minIntensity: 0, retention: 0.4 }
    this.script = [];
    this.channel = new BroadcastChannel('chat-channel');
    console.log("part Constructed")

  }

  async load(botId,partName){
    if (!await db.partExists(botId,partName)){
      postMessage({type:'not-found'});
      return;
    }

    const data = await db.loadPart(botId,partName);
    this.encoder = data.encoder;
    this.decoder = data.decoder;
    this.avatar = data.avatar;
    this.response = {...data.response};
    this.script = [...data.script];

    postMessage({type: 'loaded'});
  }
}

const part = new Part();

onmessage = function (event) {
  const action = event.data;
  const botId = action.botId;
  switch (action.type) {
    case 'load': {
      part.load(botId, action.partName);
      postMessage({type:'partLoaded'});

      // postMessage({type:'partDeployed'});
      break;
    }
    default:
      throw new Error(`central: invalid action ${action.type}`);
  }
}