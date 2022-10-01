import { EditorContainer } from "./EditorContainer";

export const Page = ({ setAlert, darkMode, setDarkMode }) => {
  return (
    <EditorContainer
      setAlert={setAlert}
      darkMode={darkMode}
      setDarkMode={setDarkMode}
    />
  );
};
