import React, { useEffect } from 'react';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

const palette = [
  '#4b9e2e',
  '#8f9e2e',
  '#9e842e',
  '#9e552e',
  '#9e2e35',
  '#9e2e62',
  '#9e2e91',
  '#5e2e9e',
  '#3f2e9e',
  '#2e509e',
  '#2e789e',
  '#2e9e72',
];

const menuItems = palette.map(col => (
  <MenuItem value={col}>
    <Box
      sx={{
        px: 3,
        py: 0,
        backgroundColor: col
      }}
    >
      <Typography color="#FFFFFF">背景色</Typography>
    </Box>
  </MenuItem>
));
export default function ColorPicker({ value, handleChange }) {
  useEffect(() => {
    if (value === "") {
      handleChange(palette[0]);
    }
  }, [value, handleChange]);



  return (
    <FormControl sx={{ m: 1 }} size="small">
      <Select
        labelId="color-selector-label"
        id="color-selector"
        value={value}
        onChange={e => handleChange(e.target.value)}
      >
        {menuItems}
      </Select>

    </FormControl>

  )
}