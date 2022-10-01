import { EditorContainer } from "./EditorContainer";
import { Box, Divider, Drawer, Toolbar } from "@mui/material";
import { TopNav } from "./TopNav";
import { DocList } from "./DocList";
import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const drawerWidth = 240;
export const Page = ({ setAlert, darkMode, setDarkMode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [filename, setFilename] = useState(location.pathname);
  const [error, setError] = useState();

  useEffect(() => {
    if (error) setAlert({ severity: "error", message: error.message });
  }, [error]);

  useEffect(() => navigate(filename), [navigate, filename]);

  return (
    <>
      <Box sx={{ display: "flex" }}>
        <TopNav darkMode={darkMode} setDarkMode={setDarkMode} />
        <Drawer
          variant="permanent"
          sx={{
            width: drawerWidth,
            flexShrink: 0,
            [`& .MuiDrawer-paper`]: {
              width: drawerWidth,
              boxSizing: "border-box",
            },
          }}
        >
          <Toolbar />
          <Divider />
          <DocList
            filename={filename}
            setFilename={setFilename}
            setAlert={setAlert}
            setError={setError}
          />
          <Divider />
        </Drawer>
        <Box
          component="main"
          sx={{ flexGrow: 1, bgcolor: "background.default", p: 2 }}
        >
          <Toolbar />
          <EditorContainer
            filename={filename}
            setAlert={setAlert}
            setError={setError}
          />
        </Box>
      </Box>
    </>
  );
};
