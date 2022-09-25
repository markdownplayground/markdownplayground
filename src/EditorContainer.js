import React from 'react';
import {EditorState, convertToRaw, convertFromRaw} from 'draft-js';
import {Editor} from "react-draft-wysiwyg"
import "react-draft-wysiwyg/dist/react-draft-wysiwyg.css";
import "prismjs/themes/prism.min.css";
import {draftToMarkdown, markdownToDraft} from 'markdown-draft-js';
import {fallbackRender} from "./fallbackRender";
import {ErrorBoundary} from "react-error-boundary";
import PrismDecorator from "draft-js-prism";
import Prism from 'prismjs'

function uploadImageCallBack(file) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://api.imgur.com/3/image');
        xhr.setRequestHeader('Authorization', 'Client-ID XXXXX');
        const data = new FormData();
        data.append('image', file);
        xhr.send(data);
        xhr.addEventListener('load', () => {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
        });
        xhr.addEventListener('error', () => {
            const error = JSON.parse(xhr.responseText);
            reject(error);
        });
    });
}

const decorator = new PrismDecorator({
});

export const EditorContainer = () => {

    const [editorState, setEditorState] = React.useState(() => EditorState.createEmpty(decorator));

    return <div>
        <div className='editor'>
            <Editor
                editorState={editorState}
                onEditorStateChange={setEditorState}
                toolbar={{
                    options: ['inline', 'blockType', 'list', 'link'],
                    inline: {options: ['bold', 'italic']},
                    blockType: {options: ['Normal', 'H1', 'H2', 'H3', 'Code'], inDropdown:false},
                    list: {options: ['unordered', 'ordered']},
                    image: {uploadCallback: uploadImageCallBack, alt: {present: true, mandatory: true}},
                }}
            /></div>
        <ErrorBoundary fallbackRender={fallbackRender}>
            <div className='preview'>
                <p>Preview</p>
                <pre>
            <code>
            {editorState && draftToMarkdown(convertToRaw(editorState.getCurrentContent()), {})}
            </code>

        </pre>
            </div>
        </ErrorBoundary>
    </div>

}




