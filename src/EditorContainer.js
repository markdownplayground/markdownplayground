import React, {useEffect, useState} from 'react';
import {convertFromRaw, convertToRaw, Editor, EditorState} from 'draft-js';
import "draft-js/dist/Draft.css"
import {draftToMarkdown, markdownToDraft} from 'markdown-draft-js';
import {useLocation} from 'react-router-dom';
import {
    Alert, AppBar,
    Autocomplete,
    Button, Grid,
    LinearProgress,
    Snackbar,
    TextField,
    ToggleButton,
    ToggleButtonGroup, Toolbar
} from "@mui/material";
import "prismjs/themes/prism.min.css";

import RichUtils from "draft-js/lib/RichTextEditorUtil";
import {
    Code, FormatBold,
    FormatItalic,
    FormatListBulleted,
    FormatListNumbered,
    Save
} from "@mui/icons-material";
import PrismDecorator from "draft-js-prism";
import getDefaultKeyBinding from "draft-js/lib/getDefaultKeyBinding";
import Modifier from "draft-js/lib/DraftModifier";
import Prism from 'prismjs'

require('prismjs/components/prism-bash.min')
require('prismjs/components/prism-go.min')
require('prismjs/components/prism-graphql.min')
require('prismjs/components/prism-jsx')
require('prismjs/components/prism-java.min')
require('prismjs/components/prism-json.min')
require('prismjs/components/prism-lua.min')
require('prismjs/components/prism-protobuf.min')
require('prismjs/components/prism-rust.min')
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

const decorator = new PrismDecorator({getSyntax});

export const EditorContainer = () => {
    const location = useLocation();
    const [filename, setFilename] = useState(location.pathname);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState();
    const [info, setInfo] = useState()
    const [editorState, setEditorState] = useState(() => EditorState.createEmpty(decorator));
    const [docs, setDocs] = useState([]);

    useEffect(() => {
        setError(null);
        setLoading(true);
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
            .finally(() => setLoading(false))
    }, [])

    useEffect(() => {
        setError(null);
        setLoading(true);
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
            .finally(() => setLoading(false))
    }, [filename])

    const currentBlockType = editorState
        .getCurrentContent()
        .getBlockForKey(editorState.getSelection()?.getStartKey())
        .getType() || 'unstyled';
    return <>
        <AppBar component="nav">
            <Toolbar>

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


                <Button color="inherit"

                        onClick={() => {
                            setError(null);
                            setLoading(true);
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
                                .finally(() => setLoading(false))
                        }
                        }
                ><Save/> Save</Button>
                <Autocomplete freeSolo renderInput={params => <TextField {...params} variant="standard"/>}
                              options={docs.map(doc => doc.path)}
                              onChange={(e, f) => setFilename(f)}
                              placeholder='Select file...'
                              fullWidth={true}
                />
            </Toolbar>
        </AppBar>
            <Toolbar/>
        <Grid container spacing={3} component='main'>
            <Grid item xs={12}>
                {error && <Snackbar open={true} autoHideDuration={3000} onClose={() => setError(null)}><Alert
                    severity="error">{error.message}</Alert></Snackbar>}
                {info && <Snackbar open={true} autoHideDuration={3000} onClose={() => setInfo(null)}><Alert
                    severity="info">{info.message}</Alert></Snackbar>}
                {loading && <LinearProgress/>}
            </Grid>

            <Grid item xs={12}>
                <Editor editorState={editorState} onChange={setEditorState} placeholder='Tell a story...'
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
                />

            </Grid>
        </Grid></>
        ;

}




