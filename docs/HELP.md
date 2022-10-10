# Help

This document is here to help you understand how to write executable documentation.

## There are two main types of code blocks:

- **Executable blocks** are blocks that have the language `bash`.
- **Savable blocks** are blocks whose first line contains the filename to save the file out as.

Executable block:

```bash
echo "Hello world!"
```

Savable block:

```javascript
// hello.js
function yes() {
  console.log("Hello world!");
}
```

You can see the file:

```bash
cat hello.js
```

You can have long running processes:

```bash
# sleep.bash
set -eux
sleep 30
echo "Hello World!"
```

You can use standard shell commands:

```bash
ls
ps -aef
```
