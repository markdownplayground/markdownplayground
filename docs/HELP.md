# Help

This document is here to help you understand how to write executable documentation.

## There are two main types of code blocks:

- **executable blocks** are blocks that have the language `bash`.
- **savable blocks** are blocks whose first line contains the filename to save the file out as.

Executable block:

```bash
echo "Hello world!"
```

File block:

```javascript
// hello.js
function yes() {
  console.log("Hello world!");
}
```

You can have long running processes:

```bash
set -eux
sleep 30
echo "Hello World!"
```