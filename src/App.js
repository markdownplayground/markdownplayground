import React, { useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { EditorContainer } from "./EditorContainer";
import { fallbackRender } from "./fallbackRender";
import { BrowserRouter } from "react-router-dom";
import { Alert, Snackbar } from "@mui/material";

function App() {
  const [alert, setAlert] = useState();
  return (
    <ErrorBoundary fallbackRender={fallbackRender}>
      <BrowserRouter>
        <EditorContainer alert={alert} setAlert={setAlert} />
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
