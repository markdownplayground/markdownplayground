import { Alert, AlertTitle, Button } from "@mui/material";

export const FallbackRender = ({ error, resetErrorBoundary }) => (
  <Alert
    severity="error"
    action={
      <Button onClick={resetErrorBoundary} color="inherit" size="small">
        Try again
      </Button>
    }
  >
    <AlertTitle>{error.message}</AlertTitle>
  </Alert>
);
