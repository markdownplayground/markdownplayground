import {List, ListItem, ListItemButton, ListItemText} from "@mui/material";
import React from "react";

export const DocList = ({docs, filename, setFilename}) =>           <List>
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