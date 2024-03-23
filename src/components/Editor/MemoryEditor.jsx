import React, { useState, useEffect } from 'react';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Input from '@mui/material/Input';


export default function MemoryEditor({ required, dict, handleChangeDict }) {
  const [memory, setMemory] = useState();

  useEffect(()=>{
    if(dict && !memory){
      
    }
  },[dict, memory]);

  function handleChange(key, value) {
    setMemory(prev => ({ ...prev, [key]: value }));
  }

  return (
    <TableContainer component={Paper}>
      <Table aria-label="memory-table">
        <TableHead>
          <TableRow>
            <TableCell>キー</TableCell>
            <TableCell>値</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {required.map(row => (
            <TableRow
              key={row.key}
              sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
            >
              <TableCell component="th" scope="row">
                <Typography >{row.key}</Typography>
                <Typography variant="caption">{row.caption}</Typography>
              </TableCell>
              <TableCell>
                <Input
                  value={memory[row.key]}
                  handleChange={v => handleChange(row.key, v)}
                />
              </TableCell>
            </TableRow>
          ))}

        </TableBody>
      </Table>
    </TableContainer>
  )
}