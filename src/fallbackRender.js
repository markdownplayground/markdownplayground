
export const fallbackRender = ({error, resetErrorBoundary}) => (
    <div>
        <h1>An error occurred: {error.message}</h1>
        <button onClick={resetErrorBoundary}>Try again</button>
    </div>
);