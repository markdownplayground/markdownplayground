# Contributing

Prerequisite:

- Golang
- NPM

To run the server:

```bash
go run .
```

To run the UI:

```bash
npm start
```

Install pre-commit hook:

```bash
cat > .git/hooks/pre-commit <<EOF
set -eux
go vet .
goimports -w .
npx prettier --write .
git diff --exit-code
go generate .
go install .
EOF
chmod +x .git/hooks/pre-commit
```

To build the binary:

```bash
<go generate .
go build .
```
