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

    this.exists = this.exists.bind(this);
    this.saveScheme = this.saveScheme.bind(this);
    this.getPartNamesAndAvatarDir = this.getPartNamesAndAvatarDir.bind(this);
    this.loadScheme = this.loadScheme.bind(this);
    this.loadPart = this.loadPart.bind(this);
    this.savePart = this.savePart.bind(this);

  }


  async exists(botId) {
    //-------------------------------------------------------------
    // botIdで指定されたschemeと少なくとも１つの
    // partが存在する場合trueを返す

    const s = await this.db.scheme.where({ botId: botId }).first();
    const p = await this.db.parts.where({ botId: botId }).first();

    return !!s & !!p
  }

  async getPartNamesAndAvatarDir(botId) {
    let partList = await this.db.parts.where(['botId', 'name'])
      .between([botId, Dexie.minKey], [botId, Dexie.maxKey])
      .toArray();
    let scheme = await this.db.scheme.where({botId: botId}).first();
    console.log(partList)

    return {
      partNames: partList.map(p => p.name),
      validAvatars: scheme.validAvatars
    }
  }

  async loadScheme(botId) {
    const data = await this.db.scheme.where({ botId: botId }).first();
    return [data.payload,data.validAvatars];
  }

  async saveScheme(botId, data, avatarDict) {
    if('payload' in data ){
      const payload = data.payload;
      for (let node in payload) {
        if (node === 'main') {
          await this.db.scheme.put({ 
            botId: botId, payload: payload[node], 
            validAvatars:avatarDict[payload.main.avatarDir] })
        }
        else {
          await this.db.parts.put({ botId: botId, name: node, payload: payload[node] })
        }
      }
      return true;
    }
    await this.db.scheme.put({botId: botId, payload: data.payload})
    return true;
  }

  async loadPart(botId, partName) {
    const data = await this.db.parts.where({
      botId: botId,
      name: partName
    }).first();
    console.log(data)
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


}

export const db = new dbio();