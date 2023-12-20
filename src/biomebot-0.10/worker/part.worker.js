/*
part worker
==================================

*/
import { part } from './part.core'

self.onmessage = function (event) {
  console.log("part onmessage", event)
  const action = event.data;
  const botId = action.botId;
  switch (action.type) {
    case 'deploy': {
      (async () => {
        let result = await part.load(botId, action.partName);
        if (result) {
          self.postMessage({ type: 'partLoaded', result: result });
          result = part.deploy();
          self.postMessage({ type: 'partDeployed', result: result });
        } else {
          self.postMessage({ type: 'partNotFound' });
        }
      })();
      break;
    }

    default:
      throw new Error(`part: invalid action ${action.type}`);
  }
}
