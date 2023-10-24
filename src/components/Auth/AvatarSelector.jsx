import React from 'react';
import { useStaticQuery, graphql } from "gatsby"

import ImageList from '@mui/material/ImageList';
import ImageListItem from '@mui/material/ImageListItem';

export default function AvatarSelector({ avatarDir, handleChangeAvatarDir }) {
  const data = useStaticQuery(graphql`
  query {
    allFile(filter: {sourceInstanceName: {eq: "userAvatar"}, name: {eq: "peace"}}) {
      nodes {
        relativeDirectory
      }
    }
  }
  `);

  const dirs = data.allFile.nodes.map(node=>(node.relativeDirectory));

  return (
    <ImageList sx={{ width: 500, height: 170 }} cols={3} rowHeight={164}>
      {dirs.map((dir) => (
        <ImageListItem key={dir}
          onClick={()=>{handleChangeAvatarDir(dir)}}
          sx={{
            border: dir === avatarDir ? "4px solid" : "none",
            borderColor: 'primary.main' 
          }}
        >
          <img
            src={`../../user/avatar/${dir}/peace.svg`}
            alt={dir}
            style={{
              width: 120,
              height: 180
            }}
            loading="lazy"
          />
        </ImageListItem>
      ))}
    </ImageList>
  );
}