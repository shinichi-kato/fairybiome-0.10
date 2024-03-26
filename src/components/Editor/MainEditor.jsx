import React, { useReducer, useEffect } from 'react';
import { useStaticQuery, graphql } from "gatsby";
import Grid from '@mui/material/Grid';
import Input from '@mui/material/Input';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Slider from '@mui/material/Slider';

import AvatarSelector from './AvatarSelector';
import ColorSelector from './ColorSelector';

import { mainModel, getDefaultMemories } from './MainModel';

const chatbotsQuery = graphql`
query {
  allFile(filter: {sourceInstanceName: {eq: "botAvatar"}, ext: {eq: ".svg"}}) {
    nodes {
      relativeDirectory
      name
      sourceInstanceName
    }
  }
  site {
    siteMetadata {
      balloonBackgroundAlpha
    }
  }
}`;

function getBotAvatars(data) {
  let d = {};
  data.allFile.nodes.forEach(n => {
    const dir = n.relativeDirectory;
    if (dir !== 'default') {
      if (dir in d) {
        d[dir].push(n.name)
      } else {
        d[dir] = [n.name]
      }
    }
  })
  return d;
}

const initialState = {
  botId: null,
  dir: "",
  description: "",
  author: "",
  avatarDir: "",
  backgroundColor: "",
  timestamp: ["", ""],
  interval: {
    max: 5000,
    min: 120,
  },
  response: {
    minIntensity: 0.3
  },
  memory: getDefaultMemories(),
  message: null
};

function reducer(state, action) {
  switch (action.type) {
    case 'load': {
      const payload = action.scheme.payload;
      return {
        botId: action.botId,
        dir: action.scheme.dir,
        avatarDir: payload.avatarDir,
        author: payload.author,
        backgroundColor: payload.backgroundColor,
        timestamp: [...payload.timestamp],
        interval: { ...payload.interval },
        response: { ...payload.response },
        memory: { ...payload.memory },
        message: null
      }
    }

    case 'change': {
      if (action.subKey) {
        switch (action.key) {
          case 'memory': {
            return {
              ...state,
              memory: {
                ...state.memory,
                [action.subKey]: action.value
              }
            }
          }
          case 'interval': {
            return {
              ...state,
              interval: {
                ...state.interval,
                [action.subKey]: action.value
              }
            }
          }
          case 'response': {
            return {
              ...state,
              response: {
                ...state.response,
                [action.subKey]: action.value
              }
            }
          }
          default:
            throw new Error(`invalid dict name ${action.key}`)
        }
      }
      return {
        ...state,
        [action.key]: action.value
      }

    }

    default:
      throw new Error(`invalid action ${action.type}`)
  }
}



export default function SettingsEditor({ scheme, botId }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const chatbotsSnap = useStaticQuery(chatbotsQuery);
  const botAvatars = getBotAvatars(chatbotsSnap);

  function renderItems() {
    let items = [];

    function render(children) {
      for (let child of children) {
        items.push(
          <Grid item xs={12}>
            <Typography variant="caption">
              {child.caption}
            </Typography>
          </Grid>
        );

        switch (child.inputType) {
          case 'string':
          case 'strings':
            let v = 'subKey' in child ? state[child.key][child.subKey] : state[child.key];
            items.push(
              <Grid item xs={12}>
                <Input
                  value={v}
                  onChange={e => dispatch({
                    type: 'change',
                    key: child.key, subKey: child.subKey, value: e.target.value
                  })}
                  sx={{ backgroundColor: "#ffffff", p: 1 }}
                  fullWidth
                />
                {child.validator(state, v) === false &&
                  <Alert severity="error">入力値が正しくありません</Alert>
                }
              </Grid>
            )
            break;
          case 'text': {
            items.push(
              <Grid item xs={12}>
                <Input
                  value={state[child.key]}
                  onChange={e => dispatch({
                    type: 'change', key: child.key, value: e.target.value
                  }
                  )}
                  sx={{ backgroundColor: "#ffffff", p: 1 }}
                  maxRows={3}
                  multiline
                  fullWidth
                />
              </Grid>
            );
            break;
          }

          case 'avatar':
            items.push(
              <Grid item xs={12}>
                <AvatarSelector
                  avatars={Object.keys(botAvatars)}
                  value={state[child.key]}
                  handleChange={e => dispatch({
                    type: 'change', key: child.key, value: e.target.value
                  })}
                  bgColog={state.backgroundColor}
                />
              </Grid>
            );
            break;
          case 'color':
            items.push(
              <Grid item xs={12}>
                <ColorSelector
                  value={state[child.key]}
                  handleChange={v => dispatch({
                    type: 'change', key: child.key, value: v
                  })}
                />
              </Grid>
            );
            break;
          case 'timestamp':
            items.push(
              <Grid item xs={12}>
                {`${state[child.key][0]} ${state[child.key][1]}`}
              </Grid>
            )
            break;
          case 'hours':

            items.push(
              <Grid item xs={12}>
                <Slider
                  aria-label={child.key}
                  value={parseInt(state[child.key])}
                  step={1}
                  min={0} max={23}
                  marks
                  onChange={(e, v) => dispatch({
                    type: 'change', key: child.key, value: String(v)
                  })}
                />
              </Grid>
            )
            break;
          default:
            throw new Error(`invalid inputType ${child.inputType}`);
        }
      }
    }

    for (let group of mainModel) {
      if (group.header) {
        items.push(
          <Grid item container>
            <Typography>{group.header}</Typography>
            {render(group.children)}
          </Grid>
        )
      } else {
        items.concat(render(group.children));
      }
    }
    return items;
  }

  useEffect(() => {
    if (scheme && scheme.payload.timestamp) {
      const timestamp = scheme.payload.timestamp;
      if (state.botId !== botId &&
        (timestamp[0] !== state.timestamp[0] ||
          timestamp[1] !== state.timestamp[1])) {
        dispatch({ type: 'load', scheme: scheme, botId: botId })
      }

    }
  }, [botId, state.botId, scheme, scheme.timestamp, state.timestamp]);

  return (
    <Grid container
      spacing={2} padding={1}
    >
      {renderItems(scheme, state)}
    </Grid>
  )
}