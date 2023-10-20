/*
AuthProvider

1. AuthStateChangeでNG→サインアップ/サインイン画面
  └サインアップ

  authState       状態
  ----------------------------------------------------------------------
  init                初期状態                                            
  connected           firebase接続した                                    
  disconnected        firebase接続に失敗した
  openSignIn          サインイン画面
  openSignUp          サインアップ画面
  openUserSetting     サインオン状態で、ユーザ情報設定
  ready               サインオンしており、ユーザ情報も登録されている
  waiting　           onAuthStateChangeの結果待ち                          
  ----------------------------------------------------------------------
*/

import React, { useReducer, createContext, useEffect, useRef } from 'react';
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  getAuth, signOut
} from 'firebase/auth';

import Container from '@mui/material/Container';
import AuthDialog from './AuthDialog';

export const AuthContext = createContext();

const initialState = {
  auth: null,
  authState: 'init',
  user: null,
  errorCode: null
};

function reducer(state, action) {
  console.log(`auth - ${action.type}`);

  switch (action.type) {
    case 'connect': {
      return {
        ...initialState,
        auth: action.auth,
        authState: 'connected',
        errorCode: null
      }
    }
    case 'disconnect': {
      return {
        ...initialState,
        authState: 'disconnected'
      }
    }
    case 'login': {
      const u = action.user;
      if (!u) {
        return {
          user: null,
          authState: 'openSignIn',
          errorCode: null
        }
      }
      if (u.email === null) {
        return {
          user: {
            email: null,
            photoURL: null,
            displayName: null
          },
          authState: 'openUserSettings',
          errorCode: null
        }
      } else {
        return {
          user: {
            ...u
          },
          authState: 'ready',
          errorCode: null
        }
      }
    }

    case 'signIn': {
      return {
        ...state,
        authState: 'openSignIn',
        errorCode: null
      }
    }

    case 'signUp': {
      return {
        ...state,
        authState: 'openSignUp',
        errorCode: null
      }
    }

    case 'userSettings': {
      return {
        ...state,
        user: action.user ? action.user : state.user,
        authState: 'openUserSettings'
      }
    }

    case 'ready': {
      return {
        ...state,
        user: action.user,
        authState: 'ready',
        errorCode: null
      }
    }

    case 'waiting': {
      return {
        ...state,
        authState: 'waiting'
      }
    }

    case 'error': {
      return {
        ...state,
        errorCode: action.errorCode
      }
    }

    default:
      throw new Error(`invalid action ${action.type}`);
  }
}

export default function AuthProvider({ firebase, children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const unsubscribeRef = useRef();

  // -----------------------------------
  // 初期化
  //

  useEffect(() => {
    if (firebase) {
      const auth = getAuth(firebase);
      dispatch({
        type: "connect",
        auth: auth
      });

      unsubscribeRef.current = onAuthStateChanged(auth, user => {
        dispatch({
          type: 'login',
          user: user
        })
      });
    }

    return () => {
      if (unsubscribeRef.current) { unsubscribeRef.current(); }
    }

  }, [firebase]);

  // -----------------------------------------------------------
  //
  // ユーザ新規作成
  // emailとpasswordを用い、作成が失敗した(emailが登録済み、
  // パスワードが短すぎる等)の場合入力し直しを促す
  //

  function handleSignUp(email, password) {
    dispatch({ type: 'waiting' });
    createUserWithEmailAndPassword(state.auth, email, password)
      // 成功した場合はonAuthStateChangedがトリガされる
      .catch((error) => {
        dispatch({
          type: 'error',
          errorCode: error.code
        })
      });
  }

  // -----------------------------------------------------------
  //
  // ログイン
  // emailとpasswordを用いてログインを試みる
  //

  function handleSignIn(email, password) {
    dispatch({ type: 'waiting' });
    signInWithEmailAndPassword(state.auth, email, password)
      // 成功した場合はonAuthStateChangedがトリガされる
      .catch((error) => {
        dispatch({
          type: 'error',
          error: error
        })
      });
  }

  // -----------------------------------------------------------
  //
  // サインアウト
  //

  function handleSignOff() {
    dispatch({ type: 'waiting' })
    signOut(state.auth);
    // onAuthStateChangedがトリガされる
  }

  // -----------------------------------------------------------
  //
  // ユーザ情報変更
  //

  function handleChangeUserSettings(displayName, photoURL) {
    dispatch({
      type: 'ready',
      user: {
        ...state.user,
        photoURL: photoURL,
        displayName: displayName
      }
    })
  }

  return (
    <AuthContext.Provider
      value={{
        photoURL: state.user?.photoURL,
        displayName: state.user?.displayName,
        uid: state.usre?.uid,
        handleSignOff: handleSignOff
      }}
    >
      <Container 
        maxWidth="xs"
        disableGutters
        sx={{height: '100vh'}}>
        {children}
        <AuthDialog
          authState={state}
          authDispatch={dispatch}
          handleSignOff={handleSignOff}
          handleSignUp={handleSignUp}
          handleSignIn={handleSignIn}
          handleChangeUserSettings={handleChangeUserSettings}
        />
      </Container>
    </AuthContext.Provider>
  )
}

