import React from 'react';
import {ErrorBoundary} from "react-error-boundary";
import {EditorContainer} from './EditorContainer'
import {fallbackRender} from "./fallbackRender";

function App() {
    return (

        <ErrorBoundary fallbackRender={fallbackRender}>
            <EditorContainer/>
        </ErrorBoundary>

    );
}

export default App;
