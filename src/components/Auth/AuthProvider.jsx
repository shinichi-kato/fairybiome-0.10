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

const MESSAGE_MAP = {
  'auth/configuration-not-found': 'firebaseの認証を有効にしてください',
};

const initialState = {
  auth: null,
  authState: 'init',
  user: null,
  subState: null
};

function reducer(state, action) {
  console.log(`auth - ${action.type}`);

  switch (action.type) {
    case 'connect': {
      return {
        ...initialState,
        auth: action.auth,
        authState: 'connected',
        subState: null
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
          auth: state.auth,
          user: null,
          authState: 'openSignIn',
          subState: null
        }
      }
      if (u.email === null) {
        return {
          user: {
            email: null,
            photoURL: null,
            displayName: null
          },
          auth: state.auth,
          authState: 'openUserSettings',
          subState: null
        }
      } else {
        return {
          user: {
            ...u
          },
          auth: state.auth,
          authState: 'ready',
          subState: null
        }
      }
    }

    case 'signIn': {
      return {
        ...state,
        authState: 'openSignIn',
        subState: null
      }
    }

    case 'signUp': {
      return {
        ...state,
        authState: 'openSignUp',
        subState: null
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
        subState: null
      }
    }

    case 'waiting': {
      return {
        ...state,
        subState: 'waiting'
      }
    }

    case 'error': {
      const code = action.errorCode
      for(var msg in MESSAGE_MAP){
        if(code.indexOf(msg) !== -1){
          return {
            ...state,
            subState: MESSAGE_MAP[msg]
          }
        }
      }
      return {
        ...state,
        subState: code
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
          errorCode: error
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
        console.log(error.message);
        dispatch({
          type: 'error',
          errorCode: error.message
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

