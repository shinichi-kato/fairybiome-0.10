/*
AuthProvider

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

  AuthProviderではfirebaseのauth周りとアプリで使用するユーザ設定を
  管理する。firebaseのuserオブジェクトでは以下のパラメータを管理する。

  user: {
    email
  }

  上記に加え、追加で下記のデータをfirestoreでユーザごとに管理する
  userProps: {
    displayName,
    backgroundColor,
    avatarDir,
  }

*/

import React, { useReducer, createContext, useEffect, useRef } from 'react';
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  getAuth, signOut
} from 'firebase/auth';
import { doc, getDoc, setDoc } from "firebase/firestore";

import Landing from '../Landing/Landing';
import AuthDialog from './AuthDialog';

export const AuthContext = createContext();

const MESSAGE_MAP = {
  'configuration-not-found': 'firebaseのmail/password認証を有効にしてください',
  'invalid-login-credentials': 'ユーザが登録されていません',
  'email-already-in-use': 'ユーザは登録済みです',
  'Missing or insufficient permissions': 'firestoreのルールを読み書き可能に変更してください',
};

const initialState = {
  auth: null,
  authState: 'init',
  user: null,
  userProps: null,
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
    case 'authStateChange': {
      const u = action.user;
      const p = action.userProps || state.userProps;
      console.log(action)

      if (!u) {
        return {
          auth: state.auth,
          user: null,
          authState: 'openSignIn',
          subState: null,
          userProps: null,
        }
      }
      if (u.displayName === null) {
        return {
          user: u,
          auth: state.auth,
          authState: 'openUserSettings',
          subState: null,
          userProps: null,
        }
      }
      if (!p) {
        return {
          user: u,
          auth: state.auth,
          authState: 'openUserSettings',
          subState: null,
          userProps: null
        }
      }
      return {
        user: u,
        auth: state.auth,
        authState: 'ready',
        subState: null,
        userProps: p
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
        authState: 'openUserSettings',
        subState: null
      }
    }

    case 'changeUserSettings': {
      let user = state.user;
      let userProps = state.userProps;

      if (action.photoURL) {
        user.photoURL = action.photoURL
      }
      if (action.displayName) {
        if (!userProps) {
          userProps = {}
        }
        userProps.displayName = action.displayName;
      }
      if (action.backgroundColor) {
        if (!userProps) {
          userProps = {}
        }
        userProps.backgroundColor = action.backgroundColor;
      }
      if (action.avatarDir) {
        if (!userProps) {
          userProps = {}
        }
        userProps.avatarDir = action.avatarDir;
      }

      return {
        ...state,
        user: user,
        userProps: userProps,
      }
    }

    case 'ready': {
      return {
        ...state,
        user: action.user || state.user,
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
      for (var msg in MESSAGE_MAP) {
        if (code.indexOf(msg) !== -1) {
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

export default function AuthProvider({ firebase, firestore, children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const unsubscribeRef = useRef();
  const uid = state.user?.uid;

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
          type: 'authStateChange',
          user: user
        });
      });
    }

    return () => {
      if (unsubscribeRef.current) { unsubscribeRef.current(); }
    }

  }, [firebase]);

  // ----------------------------------------------------------
  //  ユーザ追加情報の初期化
  //  email,password以外のユーザ設定情報はfirestoreに格納しており、
  //  ここで取得する。

  useEffect(() => {
    if (uid && state.user) {
      const docRef = doc(firestore, "users", uid);

      getDoc(docRef).then(snap => {
        if (snap.exists()) {
          dispatch({
            type: 'authStateChange',
            user: state.user,
            userProps: snap.data()
          })
        }
      }).catch(error => {
        dispatch({
          type: 'error',
          errorCode: error.message
        })
      })
    }
  }, [uid, firestore, state.user]);

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
      .then()
      .catch((error) => {
        dispatch({
          type: 'error',
          errorCode: error.message
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
      .then(userCredential => {
        dispatch({
          type: 'authStateChange',
          user: userCredential.user
        });
      })
      // 成功した場合はonAuthStateChangedがトリガされる
      .catch((error) => {
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
  //  ユーザ情報の更新
  //
  //

  function handleChangeUserSettings(data) {
    if (data.backgroundColor || data.avatarDir || data.displayName) {
      const docRef = doc(firestore, "users", uid);
      setDoc(docRef, {
        backgroundColor: data.backgroundColor,
        avatarDir: data.avatarDir,
        displayName: data.displayName
      })
        .catch(error => {
          dispatch({ type: 'error', errorCode: error.message })
        });
    }
    dispatch({
      type: 'changeUserSettings',
      ...data
    })
  }

  return (
    <AuthContext.Provider
      value={{
        userProps: state.userProps,
        uid: state.user?.uid,
        handleSignOff: handleSignOff
      }}
    >
      {(state.user && state.user.uid) 
        ? 
        children 
        :
         <Landing />
      }
      <AuthDialog
        authState={state}
        uid={state.user?.uid}
        user={state.userProps}
        authDispatch={dispatch}
        handleSignOff={handleSignOff}
        handleSignUp={handleSignUp}
        handleSignIn={handleSignIn}
        handleChangeUserSettings={handleChangeUserSettings}
      />
    </AuthContext.Provider>
  )
}

