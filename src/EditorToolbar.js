import {
  Box,
  Button,
  ButtonGroup,
  MenuItem,
  Select,
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
} from "@mui/icons-material";
import RichUtils from "draft-js/lib/RichTextEditorUtil";
import React from "react";
import { EditorState } from "draft-js";
import Modifier from "draft-js/lib/DraftModifier";
import * as PropTypes from "prop-types";

export class EditorToolbar extends React.Component {
  render() {
    let {
      detected,
      currentBlock,
      editorState,
      setEditorState,
      changeIndent,
      languages,
    } = this.props;
    const addLink = () => {
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

    const removeLink = () => {
      const selection = editorState.getSelection();
      setEditorState(RichUtils.toggleLink(editorState, selection, null));
    };

    const setLanguage = (language) => {
      const selection = editorState.getSelection();
      const nextContentState = Modifier.setBlockData(
        editorState.getCurrentContent(),
        selection,
        { language }
      );
      setEditorState(
        EditorState.push(editorState, nextContentState, "change-block-data")
      );
    };

    return (
      <Box position="fixed" sx={{ bgcolor: "background.default", zIndex: 30 }}>
        <Toolbar>
          <ToggleButtonGroup
            size="small"
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
          <Select
            sx={{ width: 120 }}
            size="small"
            value={detected.language || ""}
            onChange={(e) => setLanguage(e.target.value)}
          >
            <MenuItem>
              <em>none</em>
            </MenuItem>
            {languages.map((v) => (
              <MenuItem key={v} value={v}>
                {v}
              </MenuItem>
            ))}
          </Select>
          <ToggleButtonGroup
            size="small"
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
  }
}

EditorToolbar.propTypes = {
  detected: PropTypes.any,
  currentBlock: PropTypes.any,
  editorState: PropTypes.any,
  setEditorState: PropTypes.any,
  changeIndent: PropTypes.any,
  languages: PropTypes.any,
};
