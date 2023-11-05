export class Message {
    constructor(){
      this.speakerName="";
      this.text = null;
      this.avatarDir = "";
      this.avatar = "";
      this.timestamp = null;
      this.type="user"
      

    }

    contains(text){
      return this.text !== null && this.text.indexOf(text) !== -1
    }
}