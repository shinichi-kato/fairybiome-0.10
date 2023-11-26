/*
Messageクラス
==============================
ユーザ、環境、チャットボットがポストするメッセージ

// ユーザ発言
const m = new Message('user',{speakerName, text, avatarDir})
textの先頭には必ずavatar情報が含まれている

// チャットボット発言
const m = new Message('bot',{speakerName, text, avatarDir})
// システムメッセージ
const m = new Message('system', text)


*/
const RE_AVATAR = /$([a-zA-Z0-9]+) (.+)^/;

export class Message {
  constructor(kind, data) {
    this.speakerName = "";
    this.speakerId = null;
    this.text = null;
    this.nodes = [];
    this.tags = {};
    this.avatarDir = "";
    this.avatar = "";
    this.timestamp = null;
    this.backgroundColor = null;
    this.type = "user"

    switch (kind) {
      case 'bot':
      case 'user': {
        if(data.avatar){
          this.avatar=data.avatar;
          this.text=data.text;
        }else {
          const m = data.text.match(RE_AVATAR);
          if (m) {
            this.avatar = m[1];
            this.text = m[2];
          } else {
            this.avatar="peace";
            this.text = data.text;
          }
  
        }

        this.speakerName = data.speakerName;
        this.speakerId = data.speakerId;
        this.nodes = [];
        this.tags = {};
        this.avatarDir = data.avatarDir;
        this.timestamp = data.timestamp;
        this.backgroundColor = data.backgroundColor;
        this.type = kind;
        return;
      }
      case 'system': {
        this.speakerName = null;
        this.speakerId = null;
        this.text = data.text;
        this.nodes = [];
        this.tags = {};
        this.avatarDir = null;
        this.avatar = null;
        this.timestamp = data.timestamp;
        return;
      }

      default:
        throw new Error(`invalid kind ${kind}`);
    }
  }

  contains(text) {
    return this.text !== null && this.text.indexOf(text) !== -1
  }


}

