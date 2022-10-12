import React, { createRef, useEffect, useState } from "react";
import {
  CompositeDecorator,
  convertFromRaw,
  convertToRaw,
  Editor,
  EditorBlock,
  EditorState,
} from "draft-js";
import "draft-js/dist/Draft.css";
import { draftToMarkdown, markdownToDraft } from "markdown-draft-js";
import { Box, IconButton, Toolbar } from "@mui/material";
import "prismjs/themes/prism.min.css";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import RichUtils from "draft-js/lib/RichTextEditorUtil";
import getDefaultKeyBinding from "draft-js/lib/getDefaultKeyBinding";
import Modifier from "draft-js/lib/DraftModifier";
import "xterm/css/xterm.css";
import { EditorToolbar } from "./EditorToolbar";
import { CodeTerminal } from "./CodeTerminal";
import { Terminal } from "xterm";
import { detect } from "./detect";
import { createLinkDecorator } from "./link-decorator";
import createPrismDecorator from "draft-js-prism-decorator";
import Prism from "prismjs";
import { CopyAll, PlayCircle, Save } from "@mui/icons-material";

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

const decorator = new CompositeDecorator([
  createLinkDecorator(),
  createPrismDecorator({
    // this decorator explodes if the language is unknown
    filter: (block) => Prism.languages[block.getData().get("language")],
  }),
]);

export const EditorContainer = ({ filename, setAlert, setError }) => {
  const [editorState, setEditorState] = useState(() =>
    EditorState.createEmpty(decorator)
  );
  const [termInflight, setTermInflight] = useState(0);
  const [showTerm, setShowTerm] = useState(false);
  const [editEnabled, setEditEnabled] = useState(false);

  const currentBlock = editorState
    .getCurrentContent()
    .getBlockForKey(editorState.getSelection().getStartKey());

  const detected = detect(currentBlock);
  useEffect(() => {
    fetch("/api/config")
      .then((r) => {
        if (r.ok) {
          return r.json();
        } else {
          throw new Error(r.statusText);
        }
      })
      .then((json) => setEditEnabled(json.editEnabled))
      .catch(setError);
  }, [setError]);
  useEffect(() => {
    if (!filename.endsWith(".md")) {
      return;
    }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filename]);

  const runCode = (code) => {
    setShowTerm(true);

    setTermInflight((v) => v + 1);
    fetchEventSource("/api/terminal/run", {
      method: "POST",
      body: code,
      onmessage: (msg) => {
        term.writeln(msg.data);
      },
      onerror: setError,
      onclose: () => setTermInflight((v) => v - 1),
    });
  };

  const saveCode = (code, filename) =>
    runCode(`cat > ${filename} <<EOF\n${code}\nEOF\n`);

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
          throw new Error("Failed to save " + filename + ": " + r.statusText);
        }
      })
      .catch(setError);
  };

  const resetTerm = () => {
    fetch("/api/terminal/reset", {
      method: "POST",
    })
      .then((r) => {
        if (r.ok) {
          term.clear();
        } else {
          term.writeln("⚠️ Failed to reset term: " + r.statusText);
        }
      })
      .catch(setError);
  };

  const markdown = draftToMarkdown(
    convertToRaw(editorState.getCurrentContent()),
    {}
  );
  const saveDoc = () => {
    if (!filename.endsWith("md") || !markdown) {
      return;
    }
    saveFile(filename, markdown);
  };
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
    const type = currentBlock.getType();
    if (type === "ordered-list-item" || type === "unordered-list-item") {
      setEditorState(RichUtils.onTab(e, editorState, 2));
    }
  };
  const editorRef = createRef();

  const termRef = createRef();

  useEffect(() => {
    term.open(termRef.current);
    return () => term.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {editEnabled && (
        <>
          <EditorToolbar
            editorState={editorState}
            currentBlock={currentBlock}
            detected={detected}
            setEditorState={setEditorState}
            changeIndent={changeIndent}
            languages={[
              "bash",
              "go",
              "graphql",
              "javascript",
              "java",
              "json",
              "lua",
              "protobuf",
              "python",
              "rust",
              "tsx",
              "typescript",
              "yaml",
            ]}
          />
          <Toolbar />
        </>
      )}
      <Box>
        <Editor
          editorState={editorState}
          onChange={setEditorState}
          placeholder="Tell a story..."
          spellCheck={true}
          readOnly={!editEnabled}
          keyBindingFn={(e) => {
            if (e.keyCode === 9) {
              changeIndent(e);
              return;
            }
            if (e.keyCode === 13 && currentBlock.getType() === "code-block") {
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
          blockRendererFn={blockRendererFnFactory({
            runCode,
            saveCode,
            setAlert,
          })}
          ref={editorRef}
        />
      </Box>
      <CodeTerminal
        setShowTerm={setShowTerm}
        showTerm={showTerm}
        resetTerm={resetTerm}
        term={term}
        termInflight={termInflight}
        termRef={termRef}
      />
    </>
  );
};

const blockRendererFnFactory = (props) => (block) => {
  if (block.getType() === "code-block") {
    return { component: CodeBlock, editable: true, props };
  }
};

const CodeBlock = (props) => {
  const { block, blockProps } = props;
  const { filename, exec } = detect(block);
  return (
    <Box>
      <Box>
        {exec && (
          <IconButton
            onClick={() => blockProps.runCode(block.getText())}
            edge={"start"}
          >
            <PlayCircle />
          </IconButton>
        )}
        {filename && (
          <IconButton
            onClick={() => blockProps.saveCode(block.getText(), filename)}
            edge={"start"}
          >
            <Save />
          </IconButton>
        )}
        <IconButton
          onClick={() => {
            navigator.clipboard.writeText(block.getText());
            blockProps.setAlert({ message: "Copied" });
          }}
          edge={"start"}
        >
          <CopyAll />
        </IconButton>
      </Box>
      <Box>
        <EditorBlock {...props} />
      </Box>
    </Box>
  );
};
