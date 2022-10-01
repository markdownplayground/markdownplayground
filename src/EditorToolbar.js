import {
  Box,
  Button,
  ButtonGroup,
  ToggleButton,
  ToggleButtonGroup,
  Toolbar,
} from "@mui/material";
import {
  AddLink,
  Code,
  FormatBold,
  FormatIndentDecrease,
  FormatIndentIncrease,
  FormatItalic,
  FormatListBulleted,
  FormatListNumbered,
  LinkOff,
  PlayArrow,
  Save,
} from "@mui/icons-material";
import RichUtils from "draft-js/lib/RichTextEditorUtil";
import React from "react";
import { EditorState } from "draft-js";

export const EditorToolbar = ({
  runCode,
  detected,
  saveCode,
  saveDoc,
  currentBlock,
  editorState,
  setEditorState,
  changeIndent,
}) => {
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

  return (
    <Box position="fixed" sx={{ bgcolor: "background.default", zIndex: 30 }}>
      <Toolbar>
        <ButtonGroup>
          <Button onClick={saveDoc}>
            <Save /> Save Doc
          </Button>
        </ButtonGroup>
        <ButtonGroup>
          <Button
            onClick={() => runCode(currentBlock.getText())}
            disabled={!detected.exec}
          >
            <PlayArrow /> Run Code
          </Button>
          <Button
            onClick={() => saveCode(currentBlock.getText(), detected.filename)}
            disabled={!detected.filename || detected.exec}
          >
            <Save /> Save Code
          </Button>
        </ButtonGroup>
        <ToggleButtonGroup
          value={currentBlock.getType() || "unstyled"}
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
            setEditorState(RichUtils.toggleInlineStyle(editorState, style))
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
  );
};
