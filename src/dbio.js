/*
  IndexDB I/O

  botIdはユーザ専用のbotの場合ownerIdと同じ、NPCの場合はschemeNameと同じとする。
  ユーザ専用のbotはbotIがownerIdと同じで、NPCはschemeNameと

  scheme {   
      botId
      schemeName,      // 型式名(キャラクタの呼び名ではない)
      ownerUID,        // 使用者のuid
      description,     // 説明
      updatedAt,       // 更新日時
      author,          // 作者名
      avatarDir,       // アバターのディレクトリ
      backgroundColor, // 背景色
      interval: {      // 返答生成の期間
          max,         // 最大(msec)
          min          // 最小(msec)
      },
      response: {
          minIntensity, // 応答する最小の強度
      },
      memory: {
          "{BOT_NAME}", // チャットボットの名前 ...この名前をクエリで利用
          "{I}",          // 一人称のリスト
          "{YOU}",        // 二人称のリスト
          "{AWAKENING_HOUR}", // 起床時刻
          "{BEDTIME_HOUR}", //就寝時刻
      }
  }
*/

import Dexie from "dexie";

class dbio {
  constructor() {
    this.db = new Dexie('Biomebot-0.10');
    this.db.version(1).stores({
      scheme: "botId, ownerUID",
      parts: "[botId+name]",
      flags: "botId",
      memory: "[botId+name]"
    })

    this.getDir = this.getDir.bind(this);
    this.saveScheme = this.saveScheme.bind(this);
    this.getPartNamesAndAvatarDir = this.getPartNamesAndAvatarDir.bind(this);
    this.noteSchemeValidation = this.noteSchemeValidation.bind(this);
    this.isSchemeValid = this.isSchemeValid.bind(this);
    this.loadScheme = this.loadScheme.bind(this);
    this.loadPart = this.loadPart.bind(this);
    this.savePart = this.savePart.bind(this);
    this.setPersistentCondition = this.setPersistentCondition.bind(this);

  }


  async getDir(botId) {
    //-------------------------------------------------------------
    // botIdで指定されたschemeと少なくとも１つの
    // partが存在する場合dirを返す

    const s = await this.db.scheme.where({ botId: botId }).first();
    const p = await this.db.parts.where({ botId: botId }).first();

    if(!!s && !!p){
      return s.payload.dir
    }
    return !!s & !!p
  }

  async getTimestamp(botId,schemeName){
    // schemeNameが'main'の場合scheme、その他の場合partのtimestampを返す
    if(schemeName==='main'){
      const d = await this.db.scheme.where({ botId: botId }).first();
      return d.payload.timestamp;
    }else {
      const d = await this.db.parts.where({ botId: botId }).first();
      return d.payload.timestamp;
    }

  }

  async getPartNamesAndAvatarDir(botId) {
    let partList = await this.db.parts.where(['botId', 'name'])
      .between([botId, Dexie.minKey], [botId, Dexie.maxKey])
      .toArray();
    let scheme = await this.db.scheme.where({ botId: botId }).first();
    console.log(scheme)

    return {
      partNames: partList.map(p => p.name),
      avatarDir: scheme.payload.avatarDir
    }
  }

  async loadScheme(botId) {
    /* botIdで指定されたschmemとpartsを読み込み
       {
          main:{ 
            payload:payload,
            dir:dir,
            isValid:isValid
          }
          [partName]: 
            {payload:payload}
          , ...
        } 
       という形式のデータとして返す
    */
    const main = await this.db.scheme.where({ botId: botId }).first();
    let parts = await this.db.parts.where(['botId', 'name'])
    .between([botId, Dexie.minKey], [botId, Dexie.maxKey])
    .toArray();

    if(!!main && !!parts){
      let partDict = {};
      for(let part of parts){
        partDict[part.name] = {payload:part.payload}
      }
  
      return { 
        'main': main,
        ...partDict
      };
  
    }
    return false;
  }

  async saveScheme(botId, dir, data) {
    /* data = { main: { payload:payload }, [partName]: {payload:payload} }
       という形式のデータを受取り一括でdbに書き込む。
       payloadはjsonファイルの内容。
    */ 

    let payload = 'payload' in data ? data.payload : data;

    for (let node in payload) {
      if (node === 'main') {
        await this.db.scheme.put({
          botId: botId, 
          dir: dir,
          payload: payload[node],
          isValid: false,
        })
      }
      else {
        await this.db.parts.put({
          botId: botId, 
          name: node,
          payload: payload[node],
        })
      }
    }
    return true;
  }

  async noteSchemeValidation(botId,isValid){
    return await this.db.scheme.update(botId, {isValid: isValid});
  }

  async isSchemeValid(botId){
    const data = await this.db.scheme.where({botId: botId}).first();

    return data && data.isValid;
  }

  async loadPart(botId, partName) {
    const data = await this.db.parts.where({
      botId: botId,
      name: partName
    }).first();
    return data.payload;
  }

  async savePart(botId, partName, data) {
    await this.db.parts.put({
      botId: botId,
      name: partName,
      payload: data
    });
    return true;
  }

  async clear(botId) {
    await this.db.scheme.where({ botId: botId }).delete();
    await this.db.parts.where(['botId', 'name'])
      .between([botId, Dexie.minKey], [botId, Dexie.maxKey])
      .delete();
    await this.db.flags.where(['botId', 'name'])
      .between([botId, Dexie.minKey], [botId, Dexie.maxKey])
      .toArray().delete();
    await this.db.memory.where({ botId: botId }).delete();
  }

  async setPersistentCondition(botId, partName, conditions){
    await this.db.flags.put({
      botId: botId,
      name: partName,
      conditions: conditions
    });
  }

  async getPersistentCondition(botId, partName){
    const data = await this.db.memory.where({
      botId: botId,
      name: partName
    }).first();
    return (data && data.conditions) || {};
  }

}

export const db = new dbio();