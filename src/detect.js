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
      const split = lines[0].split(" ");
      const split1 = split[1];
      const exec = split1.startsWith("*");
      const filename = exec ? split1.replace(/^\*/, "") : split1;
      return { language, filename, exec };
    }
  }
  return { language, filename: "code." + language, exec };
}
