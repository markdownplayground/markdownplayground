import {Alert, AlertTitle, Button} from "@mui/material";

export const fallbackRender = ({error, resetErrorBoundary}) => (
    <Alert severity='error'
           action={<Button onClick={resetErrorBoundary} color="inherit" size="small">Try again</Button>}>
        <AlertTitle>{error.message}</AlertTitle>
    </Alert>

);