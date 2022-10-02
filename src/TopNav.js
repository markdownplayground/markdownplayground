import { AppBar, Box, Button, Toolbar } from "@mui/material";
import { DarkMode, GitHub, LightMode } from "@mui/icons-material";
import React from "react";

export const TopNav = ({ setDarkMode, darkMode }) => (
  <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
    <Toolbar>
      <Box>
        <Box component="span">Markdown Playground</Box>
      </Box>
      <Box sx={{ ml: "auto" }}>
        <Button color="inherit" onClick={() => setDarkMode(!darkMode)}>
          {!darkMode ? <DarkMode /> : <LightMode />}
        </Button>
        <Button
          href="https://github.com/markdownplayground/markdownplayground"
          color="inherit"
        >
          <GitHub />
        </Button>
      </Box>
    </Toolbar>
  </AppBar>
);
