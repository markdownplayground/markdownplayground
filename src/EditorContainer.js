import React, {createRef, useEffect, useState} from 'react';
import {CompositeDecorator, convertFromRaw, convertToRaw, Editor, EditorState} from 'draft-js';
import "draft-js/dist/Draft.css"
import {draftToMarkdown, markdownToDraft} from 'markdown-draft-js';
import {useLocation} from 'react-router-dom';
import { useNavigate } from "react-router-dom";
import {
    Alert,
    AppBar,
    Box,
    Button,
    ButtonGroup,
    createTheme,
    CssBaseline,
    Divider,
    Drawer,
    List,
    ListItem,
    ListItemButton,
    ListItemText, Snackbar,
    ThemeProvider,
    ToggleButton,
    ToggleButtonGroup,
    Toolbar, Typography
} from "@mui/material";
import "prismjs/themes/prism.min.css";

import RichUtils from "draft-js/lib/RichTextEditorUtil";
import {
    AddLink,
    Code,
    DarkMode,
    FormatBold,
    FormatIndentDecrease,
    FormatIndentIncrease,
    FormatItalic,
    FormatListBulleted,
    FormatListNumbered,
    GitHub,
    LightMode, LinkOff,
    PlayArrow, Save
} from "@mui/icons-material";
import PrismDecorator from "draft-js-prism";
import getDefaultKeyBinding from "draft-js/lib/getDefaultKeyBinding";
import Modifier from "draft-js/lib/DraftModifier";
import Prism from 'prismjs'
import MultiDecorator from "draft-js-multidecorators";

require('prismjs/components/prism-bash.min')
require('prismjs/components/prism-go.min')
require('prismjs/components/prism-graphql.min')
require('prismjs/components/prism-jsx')
require('prismjs/components/prism-java.min')
require('prismjs/components/prism-json.min')
require('prismjs/components/prism-lua.min')
require('prismjs/components/prism-protobuf.min')
require('prismjs/components/prism-python.min')
require('prismjs/components/prism-rust.min')
require('prismjs/components/prism-tsx.min')
require('prismjs/components/prism-typescript.min')
require('prismjs/components/prism-yaml.min')

function getSyntax(block) {
    const lines = block.getText()?.split("\n");
    if (lines?.length > 0) {
        const language = lines[0].split(".").pop();
        if (Prism.languages[language]) {
            return language
        }
    }
    return 'javascript';
}


const decorator = new MultiDecorator(
    [
        new PrismDecorator({getSyntax}),
        new CompositeDecorator([
            {
                strategy: (contentBlock, callback, contentState) => {
                    contentBlock.findEntityRanges(
                        (character) => {
                            const entityKey = character?.getEntity();
                            console.log(entityKey)
                            return (
                                entityKey !== null &&
                                contentState?.getEntity(entityKey).getType() === 'LINK'
                            );
                        },
                        callback
                    );
                },
                component: (props) => {
                    const {url} = props.contentState.getEntity(props.entityKey).getData();
                    console.log(url)
                    return (
                        <a href={url} style={{
                            color: '#3b5998',
                            textDecoration: 'underline',
                        }}>
                            {props.children}
                        </a>
                    );
                }
            }
        ])
    ]);


export const EditorContainer = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [filename, setFilename] = useState(location.pathname);
    const [error, setError] = useState();
    const [info, setInfo] = useState()
    const [editorState, setEditorState] = useState(() => EditorState.createEmpty(decorator));
    const [docs, setDocs] = useState([]);

    useEffect(() => {
        navigate(filename)
    }, [navigate, filename])

    useEffect(() => {
        setError(null);
        fetch("/api/docs")
            .then(r => {
                if (r.ok) {
                    return r.json()
                } else {
                    throw new Error(r.statusText)
                }
            })
            .then(r => {
                setDocs(r.docs)
            })
            .catch(setError)
    }, [])

    useEffect(() => {
        setError(null);
        fetch("/docs/" + filename)
            .then((r) => {
                if (r.ok) {
                    return r.text()
                } else {
                    throw new Error(filename + ": " + r.statusText)
                }
            })
            .then(text => {
                setEditorState(EditorState.createWithContent(convertFromRaw(markdownToDraft(text)), decorator));
                setInfo({message: "Loaded " + filename})
            })
            .catch(setError)
    }, [filename])

    useEffect(() => {
        setError(null);
        fetch("/docs/" + filename)
            .then((r) => {
                if (r.ok) {
                    return r.text()
                } else {
                    throw new Error(filename + ": " + r.statusText)
                }
            })
            .then(text => {
                setEditorState(EditorState.createWithContent(convertFromRaw(markdownToDraft(text)), decorator));
                setInfo({message: "Loaded " + filename})
            })
            .catch(setError)
    }, [filename])

    const currentBlock = editorState
        .getCurrentContent()
        .getBlockForKey(editorState.getSelection()?.getStartKey());
    const currentBlockType = currentBlock
        .getType() || 'unstyled';

    const play = () => {
        const code = currentBlock.getText();
        const name = code.split("\n")[0].split(" ").pop()
        setInfo({message: "Run: " + name})
    }

    const drawerWidth = 240;

    const save = () => {
        setError(null);
        const raw = convertToRaw(editorState.getCurrentContent());
        fetch("/docs/" + filename, {
            method: "PUT",
            body: draftToMarkdown(raw, {})
        })
            .then(r => {
                if (r.ok) {
                    setInfo({message: filename + " saved"})
                } else {
                    throw new Error("failed to save " + filename + ": " + r.statusText)
                }
            })
            .catch(setError)
    };
    const [darkMode, setDarkMode] = useState(false);

    const addLink = (e) => {
        e.preventDefault();
        const contentState = editorState.getCurrentContent();
        const contentStateWithEntity = contentState.createEntity(
            'LINK',
            'MUTABLE',
            {url: prompt("Enter URL")}
        );
        const entityKey = contentStateWithEntity.getLastCreatedEntityKey();
        const newEditorState = EditorState.set(editorState, {currentContent: contentStateWithEntity});
        setEditorState(RichUtils.toggleLink(
            newEditorState,
            newEditorState.getSelection(),
            entityKey
        ));
    };
    const removeLink = (e) => {
        e.preventDefault();
        const {editorState} = this.state;
        const selection = editorState.getSelection();
        if (!selection.isCollapsed()) {
            setEditorState(RichUtils.toggleLink(editorState, selection, null))
        }
    }

    const changeIndent = (e, indentDirection) => {
        e.preventDefault()
        if (indentDirection === 'decrease') {
            e.shiftKey = true
        }
        if (currentBlockType === 'ordered-list-item' || currentBlockType === 'unordered-list-item') {
            setEditorState(RichUtils.onTab(e, editorState, 2))
        }
    }

    const editorRef = createRef();

    useEffect(() => editorRef.current?.focus(), [editorRef, editorState]);

    return <ThemeProvider theme={createTheme({
        palette: {
            mode: darkMode ? 'dark' : 'light',
        },
    })}>
        <Box sx={{display: 'flex'}}>
            <CssBaseline/>
            <AppBar position="fixed" sx={{zIndex: (theme) => theme.zIndex.drawer + 1}}>
                <Toolbar sx={{justifyContent: "space-between"}}>
                    <Typography>
                        Markdown Playground
                    </Typography>
                    <div/>
                    <div>
                        <Button color='inherit' onClick={() => setDarkMode(!darkMode)}>{!darkMode ? <DarkMode/> :
                            <LightMode/>}</Button>
                        <Button href='https://github.com/markdownplayground' color='inherit'>
                            <GitHub/>
                        </Button>
                    </div>
                </Toolbar>
            </AppBar>
            <Drawer
                variant="permanent"
                sx={{
                    width: drawerWidth,
                    flexShrink: 0,
                    [`& .MuiDrawer-paper`]: {width: drawerWidth, boxSizing: 'border-box'},
                }}
            >
                <Toolbar/>
                <Divider/>
                <List>
                    {docs.filter(({path}) => path.split("/").length < 3).map(({title, path}) => (
                        <ListItem key={path} disablePadding>
                            <ListItemButton onClick={() => setFilename(path)}>
                                <ListItemText primary={title}/>
                            </ListItemButton>
                        </ListItem>
                    ))}
                </List>
                <Divider/>
            </Drawer>
            <Box
                component="main"
                sx={{flexGrow: 1, bgcolor: 'background.default', p: 3}}
            >
                <Toolbar/>
                <Box>
                    <Toolbar>
                        <ButtonGroup>
                            <Button onClick={() => play()}>
                                <PlayArrow/> Run
                            </Button>
                            <Button onClick={save}><Save/> Save</Button>
                        </ButtonGroup>
                        <ToggleButtonGroup value={currentBlockType}
                                           exclusive
                                           onChange={(e, style) => setEditorState(RichUtils.toggleBlockType(editorState, style))}>

                            <ToggleButton value="header-one">H1</ToggleButton>
                            <ToggleButton value="header-two">H2</ToggleButton>
                            <ToggleButton value="header-three">H3</ToggleButton>
                            <ToggleButton value="unstyled">Normal</ToggleButton>
                            <ToggleButton value="unordered-list-item"><FormatListBulleted/></ToggleButton>
                            <ToggleButton value="ordered-list-item"><FormatListNumbered/></ToggleButton>
                            <ToggleButton value="code-block"><Code/></ToggleButton>
                        </ToggleButtonGroup>
                        <ToggleButtonGroup value={editorState.getCurrentInlineStyle().toArray()}
                                           onChange={(style) => setEditorState(RichUtils.toggleInlineStyle(editorState, style))}
                        >
                            <ToggleButton value="BOLD"><FormatBold/></ToggleButton>
                            <ToggleButton value="ITALIC"><FormatItalic/></ToggleButton>
                        </ToggleButtonGroup>
                        <ButtonGroup>
                            <Button onClick={(e) => changeIndent(e, 'decrease')}>
                                <FormatIndentDecrease/>
                            </Button>
                            <Button onClick={(e) => changeIndent(e, 'increase')}>
                                <FormatIndentIncrease/>
                            </Button>
                        </ButtonGroup>
                        <ButtonGroup>
                            <Button onClick={addLink}>
                                <AddLink/>
                            </Button>
                            <Button onClick={removeLink}>
                                <LinkOff/>
                            </Button>
                        </ButtonGroup>
                    </Toolbar>
                </Box>
                <Box>
                    <Editor
                        editorState={editorState}
                        onChange={setEditorState}
                        placeholder='Tell a story...'
                        spellCheck={true}

                        blockStyleFn={(block) => {
                            if (block.getType() === "code-block") {
                                return " language-" + getSyntax(block)
                            }
                        }}
                        keyBindingFn={(e) => {
                            if (e.keyCode === 13 && currentBlockType === 'code-block') {
                                const newContentState = Modifier.insertText(editorState.getCurrentContent(), editorState.getSelection(), '\n');
                                const newEditorState = EditorState.push(editorState, newContentState, "insert-characters");
                                setEditorState(newEditorState);
                                return 'add-newline';
                            }
                            return getDefaultKeyBinding(e);
                        }}
                        onTab={e => changeIndent(e)}
                        ref={editorRef}
                    />

                </Box>
            </Box>
            {error && <Snackbar open={true} autoHideDuration={3000} onClose={() => setError(null)}><Alert
                severity="error">{error.message}</Alert></Snackbar>}
            {info && <Snackbar open={true} autoHideDuration={3000} onClose={() => setInfo(null)}><Alert
                severity="info">{info.message}</Alert></Snackbar>}
        </Box></ThemeProvider>
        ;

}




