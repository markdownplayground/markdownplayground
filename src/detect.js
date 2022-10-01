import Prism from "prismjs";

export function detect(block) {
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