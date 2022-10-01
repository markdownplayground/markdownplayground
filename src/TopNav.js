import {AppBar, Button, Toolbar, Typography} from "@mui/material";
import {DarkMode, GitHub, LightMode} from "@mui/icons-material";
import React from "react";

export const TopNav = ({setDarkMode, darkMode}) => <AppBar
    position="fixed"
    sx={{zIndex: (theme) => theme.zIndex.drawer + 1}}
>
    <Toolbar sx={{justifyContent: "space-between"}}>
        <Typography>Markdown Playground</Typography>
        <div/>
        <div>
            <Button color="inherit" onClick={() => setDarkMode(!darkMode)}>
                {!darkMode ? <DarkMode/> : <LightMode/>}
            </Button>
            <Button
                href="https://github.com/markdownplayground/markdownplayground"
                color="inherit"
            >
                <GitHub/>
            </Button>
        </div>
    </Toolbar>
</AppBar>