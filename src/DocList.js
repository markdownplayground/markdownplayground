import { List, ListItem, ListItemButton, ListItemText } from "@mui/material";
import React, { useEffect, useState } from "react";

export const DocList = ({ filename, setFilename, setAlert, setError }) => {
  const [docs, setDocs] = useState([]);

  useEffect(() => {
    setAlert({ message: "Listing files" });
    fetch("/api/files")
      .then((r) => {
        if (r.ok) {
          return r.json();
        } else {
          throw new Error(r.statusText);
        }
      })
      .then((r) => {
        setDocs(r.docs);
      })
      .catch(setError);
  }, [setAlert, setError]);

  return (
    <List>
      {docs
        .filter(({ path }) => path.split("/").length < 3)
        .map(({ title, path }) => (
          <ListItem key={path} disablePadding>
            <ListItemButton
              onClick={() => setFilename(path)}
              selected={filename === path}
            >
              <ListItemText primary={title} secondary={path} />
            </ListItemButton>
          </ListItem>
        ))}
    </List>
  );
};
