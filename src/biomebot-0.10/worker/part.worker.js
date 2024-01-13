/*
part worker
==================================

*/
import { part } from './part.core';

onmessage = (event) => {
  const action = event.data;
  const botId = action.botId;
  switch (action.type) {
    case 'deploy': {
      (async () => {
        let result = await part.load(botId, action.partName, action.validAvatars);
        if (result.status === 'ok') {
          postMessage({ type: 'partLoaded', result: result });
          result = part.deploy();
          postMessage({ type: 'partDeployed', result: result });
        } else {
          postMessage({ type: 'partNotFound' ,result: result});
        }
      })();
      break;
    }

    case 'test': {
      console.log(part.channel);
      break;
    }

    default:
      throw new Error(`part: invalid action ${action.type}`);
  }
}
