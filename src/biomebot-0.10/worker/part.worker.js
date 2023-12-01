/*
part worker
==========================

*/

import { db } from '../../dbio.js';


class Part {
  constructor(matrixizer) {
    this.matrixizer = matrixizer;
    this.decoder = null;
    this.avatar = null;
    this.response = { minIntensity: 0, retention: 0.4 }
    this.script = [];
    this.channel = new BroadcastChannel('biomebot');
    console.log("part Constructed")

  }

  async load(botId,partName){
    if (!await db.partExists(botId,partName)){
      return false;
    }

    const data = await db.loadPart(botId,partName);
    this.encoder = data.encoder;
    this.decoder = data.decoder;
    this.avatar = data.avatar;
    this.response = {...data.response};
    this.script = [...data.script];
    this.validAvatars = data.validAvatars

    return true;
  }

  async deploy(){
    this.matrixizer(this.script);
    

  }
}

const part = new Part();

onmessage = function (event) {
  const action = event.data;
  const botId = action.botId;
  switch (action.type) {
    case 'load': {
      (async ()=>{
        const result = await part.load(botId, action.partName);
        if(result){
          this.postMessage({type: 'partLoaded'});
          await part.deploy();
          this.postMessage({type: 'partDeployed'});
        } else {
          this.postMessage({type: 'partNotFound'});
        }
      })();
      break;
    }

    case 'deploy': {
      (async ()=>{
        await part.deploy();
      })();
      break;
    }

    default:
      throw new Error(`part: invalid action ${action.type}`);
  }
}