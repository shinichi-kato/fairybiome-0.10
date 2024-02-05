import React, { useReducer, useEffect } from 'react';
import { useStaticQuery, graphql } from "gatsby";
import Grid from '@mui/material/Grid';
import Input from '@mui/material/Input';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';

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
  memory: {
    "{BOT_NAME}": ""
  },
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

    case 'changeValue': {
      return {
        ...state,
        [action.key]: action.value
      }
    }

    case 'changeIntervMin': {
      const val = parseInt(action.value);
      const stateMax = parseInt(state.interval.max);

      return {
        ...state,
        interval: {
          max: state.interval.max,
          min: action.value
        },
        message: (val >= 0 && stateMax > val) ? null : "error:interval.min"
      }
    }
    case 'changeIntervMax': {
      const val = parseInt(action.value);
      const stateMin = parseInt(state.interval.min);

      return {
        ...state,
        interval: {
          max: action.value,
          min: state.interval.min
        },
        message: (val >= 0 && val > stateMin) ? null : "error:interval.max"
      }
    }


    default:
      throw new Error(`invalid action ${action.type}`);
  }
}

export default function MainEditor({ scheme, botId }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const chatbotsSnap = useStaticQuery(chatbotsQuery);
  const botAvatars = getBotAvatars(chatbotsSnap);

  useEffect(() => {
    if (scheme && scheme.payload.timestamp) {
      const timestamp = scheme.payload.timestamp;
      if (state.botId !== botId &&
        (timestamp[0] !== state.timestamp[0] ||
          timestamp[1] !== state.timestamp[1])) {
        dispatch({ type: 'load', scheme: scheme, botId: botId })
      }

    }
  }, [botId, scheme, scheme.timestamp, state.timestamp]);

  return (
    <Grid container
      spacing={2}
      padding={1}
    >
      <Grid item xs={3}>
        id
      </Grid>
      <Grid item xs={8}>
        {state.botId}
      </Grid>
      <Grid item xs={12}>
        チャットボットの概要
      </Grid>
      <Grid item xs={12}>
        <Input
          placeholder="チャットボットの概要"
          value={state.description}
          onChange={e => dispatch({ type: 'changeValue', key: 'description', value: e.target.value })}
          maxRows={3}
          multiline
          fullWidth
          sx={{
            backgroundColor: "#ffffff",
            p: 1
          }}
        />
      </Grid>
      <Grid item xs={3}>
        作者
      </Grid>
      <Grid item xs={8}>
        <Input
          value={state.author}
          onChange={e => dispatch({ type: 'changeValue', key: 'author', value: e.target.value })}
          sx={{
            backgroundColor: "#ffffff",
            p: 1
          }}
        />
      </Grid>
      <Grid item xs={3}>
        背景色
      </Grid>
      <Grid item xs={12}>

      </Grid>
      <Grid item xs={3}>
        更新日時
      </Grid>
      <Grid item xs={8}>
        {`${state.timestamp[0]} ${state.timestamp[1]}`}
      </Grid>
      <Grid item xs={12}>
        返答のインターバル
        <Typography variant="caption">チャットボットが返答するまでの時間は変動します</Typography>
      </Grid>
      <Grid item xs={3}>
        最短値(msec)
      </Grid>
      <Grid item xs={8}>
        <Input
          value={state.interval.min}
          onChange={e => dispatch({ type: 'changeIntervMin', value: e.target.value })}
          sx={{
            backgroundColor: "#ffffff",
            p: 1
          }}
          error={state.message === 'error:interval.min'}
        />
        {state.message === 'error:interval.min' &&
          <Alert severity='error'>
            正の整数で、最長値よりも小さい値を指定してください</Alert>
        }
      </Grid>
      <Grid item xs={3}>
        最長値(msec)
      </Grid>
      <Grid item xs={8}>
        <Input
          value={state.interval.max}
          onChange={e => dispatch({ type: 'changeIntervMax', value: e.target.value })}
          sx={{
            backgroundColor: "#ffffff",
            p: 1
          }}
          error={state.message === 'error:interval.max'}
        />
        {state.message === 'error:interval.max' &&
          <Alert severity='error'>
            正の整数で、最短値より大きい値を指定してください</Alert>
        }
      </Grid>
    </Grid>
  )
}