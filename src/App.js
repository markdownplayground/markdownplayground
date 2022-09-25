import React from 'react';
import {ErrorBoundary} from "react-error-boundary";
import {EditorContainer} from './EditorContainer'

function App() {
    return (
        <div>
            <ErrorBoundary fallbackRender={({error, resetErrorBoundary, componentStack}) => (
                <div>
                    <h1>An error occurred: {error.message}</h1>
                    <button onClick={resetErrorBoundary}>Try again</button>
                </div>
            )}
            >

                <EditorContainer/>
            </ErrorBoundary>
        </div>
    );
}

export default App;
