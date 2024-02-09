import React from 'react';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';




export default function AvatarSelector({
  avatars, backgroundColor, value, handleChange }
) {
  const menuItems = avatars.map(dir => (
    <MenuItem value={dir}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center'
        }}
      >
        <Box>
          <Avatar
            alt={dir}
            src={`/chatbot/avatar/${dir}/avatar.svg`}
            sx={{ bgcolor: backgroundColor }}
          />

        </Box>
        <Box>
          {dir}
        </Box>
      </Box>
    </MenuItem>
  ))


  return (
    <FormControl sx={{ m: 1 }} size="small">
      <Select
        labelId="avatar-selector-label"
        id="avatar-selector"
        value={value}
        onChange={handleChange}
      >
        {menuItems}
      </Select>

    </FormControl>

  )
}