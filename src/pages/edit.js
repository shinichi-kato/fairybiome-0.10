import React from 'react';
import { graphql } from 'gatsby'
import Container from '@mui/material/Container';
import AuthProvider from '../components/Auth/AuthProvider';
import useFirebase from "../useFirebase";
import Editor from '../components/Editor/Editor';


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
        <Editor firestore={firestore}/>
      </AuthProvider>
    </Container>

  );
}

export const Head = ({data}) =>
  <>
    <html lang="ja" />
    <title>{data.site.siteMetadata.title}</title>
  </>

export const query = graphql`
query IndexPageQuery {
    site {
      siteMetadata {
        title
      }
    }
 }
`;