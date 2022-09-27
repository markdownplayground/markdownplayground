import React, {createRef, useEffect, useState} from "react";
import {CompositeDecorator, convertFromRaw, convertToRaw, Editor, EditorState,} from "draft-js";
import "draft-js/dist/Draft.css";
import {draftToMarkdown, markdownToDraft} from "markdown-draft-js";
import {useLocation, useNavigate} from "react-router-dom";
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
  LinearProgress,
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
  Typography,
} from "@mui/material";
import "prismjs/themes/prism.min.css";
import {fetchEventSource} from "@microsoft/fetch-event-source";
import RichUtils from "draft-js/lib/RichTextEditorUtil";
import {
  AddLink,
  Close,
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
  Save,
} from "@mui/icons-material";
import PrismDecorator from "draft-js-prism";
import getDefaultKeyBinding from "draft-js/lib/getDefaultKeyBinding";
import Modifier from "draft-js/lib/DraftModifier";
import Prism from "prismjs";
import MultiDecorator from "draft-js-multidecorators";
import {Terminal} from "xterm";
import "xterm/css/xterm.css";

require("prismjs/components/prism-bash.min");
require("prismjs/components/prism-go.min");
require("prismjs/components/prism-graphql.min");
require("prismjs/components/prism-jsx");
require("prismjs/components/prism-java.min");
require("prismjs/components/prism-json.min");
require("prismjs/components/prism-lua.min");
require("prismjs/components/prism-protobuf.min");
require("prismjs/components/prism-python.min");
require("prismjs/components/prism-rust.min");
require("prismjs/components/prism-tsx.min");
require("prismjs/components/prism-typescript.min");
require("prismjs/components/prism-yaml.min");

function detect(block) {
  if (block.getType() !== "code-block") {
    return {};
  }
  const lines = block.getText()?.split("\n");
  if (lines?.length > 0) {
    const line0 = lines[0];
    if (line0.startsWith("// ") || line0.startsWith("# ")) {
      const split = lines[0].split(" ");
      const split1 = split[1];
      const exec = split1.startsWith("*");
      const filename = exec ? split1.replace(/^\*/, "") : split1;
      const language = split1.split(".").pop();
      if (Prism.languages[language]) {
        return { language, filename, exec };
      }
    }
  }
  return { language: "bash", filename: "code.bash", exec: true };
}

const term = new Terminal();

const decorator = new MultiDecorator([
  new PrismDecorator({ getSyntax: (block) => detect(block).language }),
  new CompositeDecorator([
    {
      strategy: (contentBlock, callback, contentState) => {
        contentBlock.findEntityRanges((character) => {
          const entityKey = character?.getEntity();
          return (
            entityKey !== null &&
            contentState?.getEntity(entityKey).getType() === "LINK"
          );
        }, callback);
      },
      component: (props) => {
        const { url } = props.contentState.getEntity(props.entityKey).getData();
        return (
          <a
            href={url}
            style={{
              color: "#3b5998",
              textDecoration: "underline",
            }}
          >
            {props.children}
          </a>
        );
      },
    },
  ]),
]);

export const EditorContainer = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [filename, setFilename] = useState(location.pathname);
  const [error, setError] = useState();
  const [alert, setAlert] = useState();
  const [editorState, setEditorState] = useState(() =>
    EditorState.createEmpty(decorator)
  );
  const [docs, setDocs] = useState([]);
  const [termInflight, setTermInflight] = useState(0);
  const [showTerm, setShowTerm] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  const getCurrentBlock = () =>
    editorState
      .getCurrentContent()
      .getBlockForKey(editorState.getSelection().getStartKey());

  const detected = detect(getCurrentBlock());

  useEffect(() => {
    if (error) setAlert({ severity: "error", message: error.message });
  }, [error]);

  useEffect(() => {
    navigate(filename);
  }, [navigate, filename]);

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
  }, []);

  useEffect(() => {
    setAlert({ message: "Loading " + filename + "..." });
    fetch("/api/files/" + filename)
      .then((r) => {
        if (r.ok) {
          return r.text();
        } else {
          throw new Error(filename + ": " + r.statusText);
        }
      })
      .then((text) => {
        setEditorState(
          EditorState.createWithContent(
            convertFromRaw(markdownToDraft(text)),
            decorator
          )
        );
        setAlert({ message: "Loaded " + filename });
      })
      .catch(setError);
  }, [filename]);

  const runCode = (code) => {
    setShowTerm(true);

    setTermInflight((v) => v + 1);
    fetchEventSource("/api/run", {
      method: "POST",
      body: code,
      onmessage: (msg) => {
        term.writeln(msg.data);
      },
      onerror: setError,
      onclose: () => setTermInflight((v) => v - 1),
    });
  };

  const saveCodeBlock = () => {
    const code = getCurrentBlock().getText();
    const name = detect(getCurrentBlock()).filename;

    runCode(`cat > ${name} <<EOF\n${code}\nEOF\n`);
  };

  const runCodeBlock = () => {
    runCode(getCurrentBlock().getText());
  };

  const drawerWidth = 240;

  const saveFile = (filename, text) => {
    setAlert({ message: "Saving " + filename + "..." });
    fetch("/api/files/" + filename, {
      method: "PUT",
      body: text,
    })
      .then((r) => {
        if (r.ok) {
          setAlert({ message: filename + " saved" });
        } else {
          throw new Error("failed to save " + filename + ": " + r.statusText);
        }
      })
      .catch(setError);
  };

  const saveDoc = () => {
    saveFile(
      filename,
      draftToMarkdown(convertToRaw(editorState.getCurrentContent()), {})
    );
  };

  const addLink = (e) => {
    e.preventDefault();
    const contentState = editorState.getCurrentContent();
    const contentStateWithEntity = contentState.createEntity(
      "LINK",
      "MUTABLE",
      { url: prompt("Enter URL") }
    );
    const entityKey = contentStateWithEntity.getLastCreatedEntityKey();
    const newEditorState = EditorState.set(editorState, {
      currentContent: contentStateWithEntity,
    });
    setEditorState(
      RichUtils.toggleLink(
        newEditorState,
        newEditorState.getSelection(),
        entityKey
      )
    );
  };

  const removeLink = (e) => {
    e.preventDefault();
    const { editorState } = this.state;
    const selection = editorState.getSelection();
    if (!selection.isCollapsed()) {
      setEditorState(RichUtils.toggleLink(editorState, selection, null));
    }
  };

  const changeIndent = (e, indentDirection) => {
    e.preventDefault();
    if (indentDirection === "decrease") {
      e.shiftKey = true;
    }
    const type = getCurrentBlock().getType();
    if (type === "ordered-list-item" || type === "unordered-list-item") {
      setEditorState(RichUtils.onTab(e, editorState, 2));
    }
  };

  const editorRef = createRef();

  useEffect(() => editorRef.current?.focus(), [editorRef, editorState]);

  const termRef = createRef();

  useEffect(() => {
    term.open(termRef.current);
    return () => term.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ThemeProvider
      theme={createTheme({
        palette: {
          mode: darkMode ? "dark" : "light",
        },
      })}
    >
      <Box sx={{ display: "flex" }}>
        <CssBaseline />
        <AppBar
          position="fixed"
          sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}
        >
          <Toolbar sx={{ justifyContent: "space-between" }}>
            <Typography>Markdown Playground</Typography>
            <div />
            <div>
              <Button color="inherit" onClick={() => setDarkMode(!darkMode)}>
                {!darkMode ? <DarkMode /> : <LightMode />}
              </Button>
              <Button
                href="https://github.com/markdownplayground/markdownplayground"
                color="inherit"
              >
                <GitHub />
              </Button>
            </div>
          </Toolbar>
        </AppBar>
        <Drawer
          variant="permanent"
          sx={{
            width: drawerWidth,
            flexShrink: 0,
            [`& .MuiDrawer-paper`]: {
              width: drawerWidth,
              boxSizing: "border-box",
            },
          }}
        >
          <Toolbar />
          <Divider />
          <List>
            {docs
              .filter(({ path }) => path.split("/").length < 3)
              .map(({ title, path }) => (
                <ListItem key={path} disablePadding >
                  <ListItemButton onClick={() => setFilename(path)} selected={filename === path}>
                    <ListItemText primary={title} secondary={path} />
                  </ListItemButton>
                </ListItem>
              ))}
          </List>
          <Divider />
        </Drawer>
        <Box
          component="main"
          sx={{ flexGrow: 1, bgcolor: "background.default", p: 2 }}
        >
          <Toolbar />
          <Box
            position="fixed"
            sx={{ bgcolor: "background.default", zIndex: 30 }}
          >
            <Toolbar>
              <ButtonGroup>
                <Button onClick={saveDoc}>
                  <Save /> Save Doc
                </Button>
              </ButtonGroup>
              <ButtonGroup>
                <Button
                  onClick={() => runCodeBlock()}
                  disabled={!detected.exec}
                >
                  <PlayArrow /> Run Code
                </Button>
                <Button
                  onClick={() => saveCodeBlock()}
                  disabled={!detected.filename || detected.exec}
                >
                  <Save /> Save Code
                </Button>
              </ButtonGroup>
              <ToggleButtonGroup
                value={getCurrentBlock().getType() || "unstyled"}
                exclusive
                onChange={(e, style) =>
                  setEditorState(RichUtils.toggleBlockType(editorState, style))
                }
              >
                <ToggleButton value="header-one">H1</ToggleButton>
                <ToggleButton value="header-two">H2</ToggleButton>
                <ToggleButton value="header-three">H3</ToggleButton>
                <ToggleButton value="unstyled">Normal</ToggleButton>
                <ToggleButton value="unordered-list-item">
                  <FormatListBulleted />
                </ToggleButton>
                <ToggleButton value="ordered-list-item">
                  <FormatListNumbered />
                </ToggleButton>
                <ToggleButton value="code-block">
                  <Code />
                </ToggleButton>
              </ToggleButtonGroup>
              <ToggleButtonGroup
                value={editorState.getCurrentInlineStyle().toArray()}
                onChange={(style) =>
                  setEditorState(
                    RichUtils.toggleInlineStyle(editorState, style)
                  )
                }
              >
                <ToggleButton value="BOLD">
                  <FormatBold />
                </ToggleButton>
                <ToggleButton value="ITALIC">
                  <FormatItalic />
                </ToggleButton>
              </ToggleButtonGroup>
              <ButtonGroup>
                <Button onClick={(e) => changeIndent(e, "decrease")}>
                  <FormatIndentDecrease />
                </Button>
                <Button onClick={(e) => changeIndent(e, "increase")}>
                  <FormatIndentIncrease />
                </Button>
              </ButtonGroup>
              <ButtonGroup>
                <Button onClick={addLink}>
                  <AddLink />
                </Button>
                <Button onClick={removeLink}>
                  <LinkOff />
                </Button>
              </ButtonGroup>
            </Toolbar>
          </Box>
          <Toolbar />
          <Box
            position="fixed"
            sx={{
              right: 0,
              bottom: 0,
              zIndex: 30,
              margin: 1,
              padding: 1,
              bgcolor: "background.default",
              boxShadow: 2,
            }}
            visibility={!showTerm && "hidden"}
          >
            <Toolbar variant="dense" sx={{ justifyContent: "space-between" }}>
              <div>
                <Button onClick={() => term.clear()}>Clear</Button>
                <span>{termInflight}</span>
              </div>
              <div />
              <Button onClick={() => setShowTerm(false)}>
                <Close />
              </Button>
            </Toolbar>
            {termInflight > 0 && <LinearProgress />}
            <Paper ref={termRef} />
          </Box>
          <Box>
              <Editor
                editorState={editorState}
                onChange={setEditorState}
                placeholder="Tell a story..."
                spellCheck={true}
                blockStyleFn={(block) => {
                  if (block?.getType() === "code-block") {
                    return " language-" + detect(block).language;
                  }
                }}
                keyBindingFn={(e) => {
                  if (e.keyCode === 9) {
                    changeIndent(e);
                    return;
                  }
                  if (
                    e.keyCode === 13 &&
                    getCurrentBlock().getType() === "code-block"
                  ) {
                    const newContentState = Modifier.insertText(
                      editorState.getCurrentContent(),
                      editorState.getSelection(),
                      "\n"
                    );
                    const newEditorState = EditorState.push(
                      editorState,
                      newContentState,
                      "insert-characters"
                    );
                    setEditorState(newEditorState);
                    return "add-newline";
                  }
                  return getDefaultKeyBinding(e);
                }}
                ref={editorRef}
              />
          </Box>
        </Box>
        {alert && (
          <Snackbar
            open={true}
            autoHideDuration={10000}
            onClose={() => setAlert(null)}
          >
            <Alert severity={alert.severity || "info"}>{alert.message}</Alert>
          </Snackbar>
        )}
      </Box>
    </ThemeProvider>
  );
};
