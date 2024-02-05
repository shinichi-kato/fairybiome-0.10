import React, { useReducer, useEffect, useContext } from 'react';
import Box from '@mui/material/Box';
import EditorConsoleBar from './EditorConsoleBar';

import { AuthContext } from '../../components/Auth/AuthProvider';
import MainEditor from './MainEditor';

import { downloadScheme, generateBotIdFromUserId } from '../../fsio';


const initialState = {
  page: 'init',
  botId: null,
  scheme: {
    main: {
      timestamp: ["",""]
    }
  },
}

function reducer(state, action) {
  switch (action.type) {
    case 'load': {
      console.log(action.data)
      return {
        page: 'main',
        botId: action.botId,
        scheme: action.data
      }

    }

    case 'notFound': {
      return {
        ...state,
        page: 'notFound'
      }
    }

    default:
      throw new Error(`invalid action ${action.type}`);

  }
}

export default function Editor({ firestore }) {
  const auth = useContext(AuthContext);
  const [state, dispatch] = useReducer(reducer, initialState);


  useEffect(() => {
    const botId = generateBotIdFromUserId(auth.uid)
    if (state.botId !== botId && auth.uid && firestore) {

      downloadScheme(firestore, botId)
        .then(data => {
          if (data) {
            dispatch({ type: 'load', data: data, botId: botId });
          } else {
            dispatch({ type: 'notFound' })
          }
        })
    }
  }, [state.botId, auth.uid, firestore]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: "100vh"
      }}
    >
      <Box>
        <EditorConsoleBar />
      </Box>
      <Box
        sx={{
          height: "calc ( 100vh - 48px )",
          overflowY: "scroll",
          alignItems: 'flex-end',
          flexGrow: 1,
          backgroundColor: "#dddddd"
        }}
      >
        {
          state.page === 'notFound' &&
          <Box>
            チャットボットがまだ作られていません。
          </Box>
        }
        {state.page === 'main' &&
          <MainEditor
            scheme={state.scheme.main}
            botId={state.botId}
          />
        }
      </Box>
    </Box>
  )
} 