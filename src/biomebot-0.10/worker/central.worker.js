// central worker
import 'dexie';

onmessage = function(event){
  const action = event.data;
  switch(action.type){
    case 'load':{
      // dexie上に指定されたidのcentralのデータがあればロードし
      // {type: 'loaded'}をポスト。なければ{type:'not_found'}をポスト

      break
    }

    default:
      throw new Error(`central: invalid action ${action.type}`);
  }
}