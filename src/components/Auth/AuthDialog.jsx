import React, { useReducer, useEffect } from 'react';
import Drawer from '@mui/material/Drawer';
import SignUpSignInDialog from './SignUpSignInDialog';
import UserSettingsDialog from './UserSettingsDialog';
import { Container } from '@mui/material';

const initialState = {
  futurePage: null,
  presentPage: null,
  open: false,
  unmountOnExit: false,
}

function reducer(state, action) {
  console.log(`auth - ${action.type}`);

  switch (action.type) {
    case 'setTarget': {
      if (state.presentPage === null) {
        return {
          futurePage: null,
          presentPage: action.page,
          open: true,
          unmountOnExit: false,
        }
      } else {
        return {
          futurePage: action.page,
          presentPage: state.presentPage,
          open: false,
          ummountOnExit: false,

        }
      }
    }

    case 'onExit': {
      return {
        futurePage: null,
        presentPage: state.futurePage,
        open: true,
        unmountOnExit: false
      }
    }
    case 'close': {
      return {
        futurePage: null,
        presentPage: null,
        open: false,
        umnountOnExit: true,
      }
    }
    default:
      throw new Error(`invalid action ${action.type}`);
  }
}

export default function AuthDialog({
  authState, authDispatch,
  handleSignOff, handleSignUp, handleSignIn, handleChangeUserSettings
}) {
  // signUp, signIn, userSettings画面を表示。
  // それぞれの画面を遷移する際一旦Drawerが閉じてから
  // 新たな画面のDrawerが開く

  const [state, dispatch] = useReducer(reducer, initialState)
  const targetPage = authState.authState;

  useEffect(() => {
    if (typeof targetPage === 'string' && targetPage.startsWith('open')) {
      dispatch({ type: 'setTarget', page: targetPage })
    } else {
      dispatch({ type: 'close' })
    }

  }, [targetPage]);
  
  return (
    <Drawer
      anchor="bottom"
      open={state.open}
      elevation={0}
      hideBackdrop={state.open}
      sx={{ maxWidth: 'xs', backgroundColor: 'transparent', px: 'auto' }}
      PaperProps={{
        sx: { width: 'xs', backgroundColor: 'drawerBg.main', square: true }
      }}
      SlideProps={{
        unmountOnExit: state.ummountOnExit,
        onExited: () => { dispatch({ type: 'onExit' }) }
      }}
    >
      <Container
        maxWidth="xs"
      >
        {(state.presentPage === 'openSignIn' || state.presentPage === 'openSignUp') &&
          <SignUpSignInDialog
            state={state}
            authState={authState}
            authDispatch={authDispatch}

            handleSignIn={handleSignIn}
            handleSignUp={handleSignUp}
            handleSignOff={handleSignOff}

          />
        }
        {state.presentPage === 'openUserSettings' &&
          <UserSettingsDialog
            authState={authState}
            authDispatch={authDispatch}
            handleSignOff={handleSignOff}
            handleChangeUserSettings={handleChangeUserSettings}
          />
        }

      </Container>

    </Drawer>
  )
}