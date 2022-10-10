import {
  Box,
  Button,
  ButtonGroup,
  LinearProgress,
  Paper,
  Toolbar,
} from "@mui/material";
import { Close } from "@mui/icons-material";
import React from "react";

export const CodeTerminal = ({
  showTerm,
  resetTerm,
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
    <Toolbar
      variant="dense"
      sx={{ justifyContent: "space-between" }}
      disableGutters
    >
      <ButtonGroup>
        <Button variant="outlined" onClick={() => term.clear()}>
          Clear
        </Button>
        <Button variant="outlined" onClick={() => resetTerm()}>
          Reset
        </Button>
      </ButtonGroup>
      {termInflight > 1 && <span>{termInflight} processes running</span>}
      <Box />
      <Button onClick={() => setShowTerm(false)}>
        <Close />
      </Button>
    </Toolbar>
    {termInflight > 0 && <LinearProgress />}
    <Paper ref={termRef} />
  </Box>
);
