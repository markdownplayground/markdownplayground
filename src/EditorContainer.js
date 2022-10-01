import React, { createRef, useEffect, useState } from "react";
import {
  CompositeDecorator,
  convertFromRaw,
  convertToRaw,
  Editor,
  EditorState,
} from "draft-js";
import "draft-js/dist/Draft.css";
import { draftToMarkdown, markdownToDraft } from "markdown-draft-js";
import { useLocation, useNavigate } from "react-router-dom";
import { Box, Divider, Drawer, Toolbar } from "@mui/material";
import "prismjs/themes/prism.min.css";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import RichUtils from "draft-js/lib/RichTextEditorUtil";
import PrismDecorator from "draft-js-prism";
import getDefaultKeyBinding from "draft-js/lib/getDefaultKeyBinding";
import Modifier from "draft-js/lib/DraftModifier";
import MultiDecorator from "draft-js-multidecorators";
import "xterm/css/xterm.css";
import { detect } from "./detect";
import { TopNav } from "./TopNav";
import { DocList } from "./DocList";
import { EditorToolbar } from "./EditorToolbar";
import { CodeTerminal } from "./CodeTerminal";
import { Terminal } from "xterm";

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

export const EditorContainer = ({ setAlert, darkMode, setDarkMode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [filename, setFilename] = useState(location.pathname);
  const [error, setError] = useState();
  const [editorState, setEditorState] = useState(() =>
    EditorState.createEmpty(decorator)
  );
  const [termInflight, setTermInflight] = useState(0);
  const [showTerm, setShowTerm] = useState(false);

  const getCurrentBlock = () =>
    editorState
      .getCurrentContent()
      .getBlockForKey(editorState.getSelection().getStartKey());

  const detected = detect(getCurrentBlock());

  useEffect(() => {
    if (error) setAlert({ severity: "error", message: error.message });
  }, [error]);

  useEffect(() => navigate(filename), [navigate, filename]);

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

  const markdown = draftToMarkdown(
    convertToRaw(editorState.getCurrentContent()),
    {}
  );
  const saveDoc = () => saveFile(filename, markdown);
  useEffect(() => {
    const t = setTimeout(() => saveDoc(), 3000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markdown]);

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
    <>
      <Box sx={{ display: "flex" }}>
        <TopNav darkMode={darkMode} setDarkMode={setDarkMode} />
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
          <DocList
            filename={filename}
            setFilename={setFilename}
            setAlert={setAlert}
            setError={setError}
          />
          <Divider />
        </Drawer>
        <Box
          component="main"
          sx={{ flexGrow: 1, bgcolor: "background.default", p: 2 }}
        >
          <Toolbar />
          <EditorToolbar
            detected={detected}
            editorState={editorState}
            getCurrentBlock={getCurrentBlock}
            runCodeBlock={runCodeBlock}
            saveCodeBlock={saveCodeBlock}
            saveDoc={saveDoc}
            setEditorState={setEditorState}
            changeIndent={changeIndent}
          />
          <Toolbar />
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
      </Box>
      <CodeTerminal
        setShowTerm={setShowTerm}
        showTerm={showTerm}
        term={term}
        termInflight={termInflight}
        termRef={termRef}
      />
    </>
  );
};
