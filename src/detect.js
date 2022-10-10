export function detect(block) {
  if (block.getType() !== "code-block") {
    return {};
  }
  const language = block.data.get("language");
  const exec = language === "bash";
  const lines = block.getText()?.split("\n");
  if (lines?.length > 0) {
    const line0 = lines[0];
    if (line0.startsWith("// ") || line0.startsWith("# ")) {
      const filename = lines[0].split(" ")[1];
      return { language, filename, exec };
    }
  }
  return { language, exec };
}
