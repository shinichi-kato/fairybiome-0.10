import * as React from 'react';
import Container from '@mui/material/Container';
import AuthProvider from '../components/Auth/AuthProvider';
import useFirebase from "../useFirebase";


export default function Index() {
  const [firebase, firestore] = useFirebase();

  return (
    <Container
      maxWidth="xs"
      disableGutters
      sx={{ height: '100vh' }}>
      <AuthProvider
        firebase={firebase}
        firestore={firestore}
      >
        app
      </AuthProvider>
    </Container>

  );
}

export const Head = () =>
  <>
    <html lang="jp" />
    <title>妖精バイオーム</title>
  </>