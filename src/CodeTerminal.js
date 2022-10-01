import { Box, Button, LinearProgress, Paper, Toolbar } from "@mui/material";
import { Close } from "@mui/icons-material";
import React from "react";

export const CodeTerminal = ({
  showTerm,
  setShowTerm,
  term,
  termInflight,
  termRef,
}) => (
  <Box
    position="fixed"
    sx={{
      right: 0,
      bottom: 0,
      zIndex: 30,
      margin: 1,
      padding: 1,
      bgcolor: "background.default",
      boxShadow: 2,
    }}
    visibility={!showTerm && "hidden"}
  >
    <Toolbar variant="dense" sx={{ justifyContent: "space-between" }}>
      <div>
        <Button onClick={() => term.clear()}>Clear</Button>
        <span>{termInflight}</span>
      </div>
      <div />
      <Button onClick={() => setShowTerm(false)}>
        <Close />
      </Button>
    </Toolbar>
    {termInflight > 0 && <LinearProgress />}
    <Paper ref={termRef} />
  </Box>
);
