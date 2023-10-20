import * as React from 'react';

import AuthProvider from '../components/Auth/AuthProvider';
import useFirebase from "../useFirebase";


export default function Index() {
  const [firebase, firestore] = useFirebase();

  return (
    <AuthProvider firebase={firebase}>
      app
    </AuthProvider>
  );
}

export const Head = () =>
  <>
    <html lang="jp" />
    <title>妖精バイオーム</title>
  </>