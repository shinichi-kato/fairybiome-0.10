// central worker
import {scheme} from './central.core';


onmessage = (event) => {
  const action = event.data;
  const botId = action.botId;
  console.log(action);
  switch (action.type) {
    case 'deploy': {
      // dbからロードし、行列計算
      (async () => {
        let r = await scheme.load(botId);
        if(r){

          postMessage({
            type: 'centralDeployed',
            interval: scheme.interval,
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
    case 'input': {
      scheme.recieve(action.message);
      break;
    }
    case 'run': {
      scheme.run();
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


