import React, { useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { FallbackRender } from "./FallbackRender";
import { BrowserRouter } from "react-router-dom";
import {
  Alert,
  createTheme,
  CssBaseline,
  Snackbar,
  ThemeProvider,
} from "@mui/material";
import { Page } from "./Page";

function App() {
  const [darkMode, setDarkMode] = useState();
  const [alert, setAlert] = useState();
  return (
    <ErrorBoundary fallbackRender={FallbackRender}>
      <BrowserRouter>
        <ThemeProvider
          theme={createTheme({
            palette: {
              primary: {
                main: "#FFD700",
              },
              mode: darkMode ? "dark" : "light",
            },
          })}
        >
          <CssBaseline />
          <Page
            alert={alert}
            setAlert={setAlert}
            darkMode={darkMode}
            setDarkMode={setDarkMode}
          />
        </ThemeProvider>
      </BrowserRouter>
      {alert && (
        <Snackbar
          open={true}
          autoHideDuration={10000}
          onClose={() => setAlert(null)}
        >
          <Alert severity={alert.severity || "info"}>{alert.message}</Alert>
        </Snackbar>
      )}
    </ErrorBoundary>
  );
}

export default App;
