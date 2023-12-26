// central worker
import {scheme} from './central.core';

onmessage = function (event) {
  const action = event.data;
  const botId = action.botId;
  switch (action.type) {
    case 'deploy': {
      // dbからロードし、行列計算
      (async () => {
        let r = await scheme.load(botId) && scheme.run();
        if(r){

          postMessage({
            type: 'centralDeployed',
            avatarDir: scheme.avatarDir,
            backgroundColor: scheme.backgroundColor,
            displayName: scheme.displayName,
          });
  
        }else{
          postMessage({
            type: 'not-found'
          })
        }

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


