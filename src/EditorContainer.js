import React, {createRef, useEffect, useState} from 'react';
import {CompositeDecorator, convertFromRaw, convertToRaw, Editor, EditorState} from 'draft-js';
import "draft-js/dist/Draft.css"
import {draftToMarkdown, markdownToDraft} from 'markdown-draft-js';
import {useLocation, useNavigate} from 'react-router-dom';
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
    ListItemText,
    Paper,
    Snackbar,
    ThemeProvider,
    ToggleButton,
    ToggleButtonGroup,
    Toolbar,
    Typography
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
    LightMode,
    LinkOff,
    PlayArrow,
    Save
} from "@mui/icons-material";
import PrismDecorator from "draft-js-prism";
import getDefaultKeyBinding from "draft-js/lib/getDefaultKeyBinding";
import Modifier from "draft-js/lib/DraftModifier";
import Prism from 'prismjs'
import MultiDecorator from "draft-js-multidecorators";
import {Terminal} from "xterm";
import "xterm/css/xterm.css"

import {ErrorBoundary} from "react-error-boundary";
import {fallbackRender} from "./fallbackRender";

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

function detect(block) {
    if (block.getType() !== "code-block") {
        return {}
    }
    const lines = block.getText()?.split("\n");
    if (lines?.length > 0) {
        const line0 = lines[0];
        if (line0.startsWith("// ") || line0.startsWith("# ")) {
            const split = lines[0].split(" ");
            const split1 = split[1];
            const exec = split1.startsWith("*");
            const filename = exec ? split1.replace(/^\*/, '') : split1;
            const language = split1.split(".").pop();
            if (Prism.languages[language]) {
                return {language, filename, exec}
            }
        }
    }
    return {language: 'javascript'};
}

const term = new Terminal();

const decorator = new MultiDecorator(
    [
        new PrismDecorator({getSyntax: (block) => detect(block).language}),
        new CompositeDecorator([
            {
                strategy: (contentBlock, callback, contentState) => {
                    contentBlock.findEntityRanges(
                        (character) => {
                            const entityKey = character?.getEntity();
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
    const [alert, setAlert] = useState()
    const [editorState, setEditorState] = useState(() => EditorState.createEmpty(decorator));
    const [docs, setDocs] = useState([]);

    useEffect(() => {
        navigate(filename)
    }, [navigate, filename])

    useEffect(() => {
        setError(null);
        fetch("/api/files")
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
        fetch("/api/files/" + filename)
            .then((r) => {
                if (r.ok) {
                    return r.text()
                } else {
                    throw new Error(filename + ": " + r.statusText)
                }
            })
            .then(text => {
                setEditorState(EditorState.createWithContent(convertFromRaw(markdownToDraft(text)), decorator));
                setAlert({message: "Loaded " + filename})
            })
            .catch(setError)
    }, [filename])

    useEffect(() => {
        setError(null);
        fetch("/api/files/" + filename)
            .then((r) => {
                if (r.ok) {
                    return r.text()
                } else {
                    throw new Error(filename + ": " + r.statusText)
                }
            })
            .then(text => {
                setEditorState(EditorState.createWithContent(convertFromRaw(markdownToDraft(text)), decorator));
                setAlert({message: "Loaded " + filename})
            })
            .catch(setError)
    }, [filename])

    const currentBlock = editorState
        .getCurrentContent()
        .getBlockForKey(editorState.getSelection()?.getStartKey());
    const currentBlockType = currentBlock
        .getType() || 'unstyled';

    const runCode = () => {
        if (currentBlockType !== 'code-block') {
            setAlert({severity: 'warning', message: "Please select a code block"});
            return
        }
        const code = currentBlock.getText();
        const name = code.split("\n")[0].split(" ").pop()

        setError(null)
        setAlert({message: "Running: " + name})
        fetch("/api/run", {method: "POST", body: code})
            .then(r => {
                    if (r.ok) {
                        return r.text()
                    } else {
                        throw new Error("Failed to run " + name + ": " + r.statusText)
                    }
                }
            )
            .then(text => text.split("\n").forEach(line => term.writeln(line)))
            .catch(setError)
    }

    useEffect(() => {
        if (error)
            setAlert({severity: 'error', message: error.message})
    }, [error])

    const drawerWidth = 240;

    const saveFile = (filename, text) => {
        setError(null);
        fetch("/api/files/" + filename, {
            method: "PUT",
            body: text
        })
            .then(r => {
                if (r.ok) {
                    setAlert({message: filename + " saved"})
                } else {
                    throw new Error("failed to save " + filename + ": " + r.statusText)
                }
            })
            .catch(setError)
    };
    const saveDoc = () => {
        saveFile(filename, draftToMarkdown(convertToRaw(editorState.getCurrentContent()), {}))
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

    const termRef = createRef();

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => term.open(termRef.current), [])

    const detected = detect(currentBlock);

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
                        <Button href='https://github.com/markdownplayground/markdownplayground' color='inherit'>
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
                            <Button onClick={saveDoc}><Save/> Save</Button>
                        </ButtonGroup>
                        <ButtonGroup>

                            <Button onClick={() => runCode()} disabled={!detected.exec}>
                                <PlayArrow/> Run
                            </Button>
                            <Button onClick={() => {
                                saveFile(detected.filename, currentBlock.getText())}
                            } disabled={!detected.filename||detected.exec}><Save/> Save</Button>

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
                            if (block?.getType() === "code-block") {
                                return " language-" + detect(block).language
                            }
                        }}
                        keyBindingFn={(e) => {
                            if (e.keyCode === 9) {
                                changeIndent(e, )
                                return ;
                            }
                            if (e.keyCode === 13 && currentBlockType === 'code-block') {
                                const newContentState = Modifier.insertText(editorState.getCurrentContent(), editorState.getSelection(), '\n');
                                const newEditorState = EditorState.push(editorState, newContentState, "insert-characters");
                                setEditorState(newEditorState);
                                return 'add-newline';
                            }
                            return getDefaultKeyBinding(e);
                        }}
                        ref={editorRef}
                    />
                </Box>
                <Box>
                    <ErrorBoundary fallbackRender={fallbackRender}>
                        <Paper ref={termRef}/>
                    </ErrorBoundary>
                </Box>
            </Box>
            {alert && <Snackbar open={true} autoHideDuration={3000} onClose={() => setAlert(null)}><Alert
                severity={alert.severity || 'info'}>{alert.message}</Alert></Snackbar>}
        </Box></ThemeProvider>
        ;

}




