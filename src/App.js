import React from "react";
import { ErrorBoundary } from "react-error-boundary";
import { EditorContainer } from "./EditorContainer";
import { fallbackRender } from "./fallbackRender";
import { BrowserRouter } from "react-router-dom";

function App() {
  return (
    <ErrorBoundary fallbackRender={fallbackRender}>
      <BrowserRouter>
        <EditorContainer />
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
