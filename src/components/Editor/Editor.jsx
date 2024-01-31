import React from 'react';
import Box from '@mui/material/Box';
import EditorConsoleBar from './EditorConsoleBar';

import { AuthContext } from '../../components/Auth/AuthProvider';


export default function Editor({firestore}){
    const auth = useContext(AuthContext);

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
                  flexGrow: 1
                }}
        >

        </Box>
      </Box>
    )
}