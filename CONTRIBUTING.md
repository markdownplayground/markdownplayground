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

Before pushing, install you pre-push hook:

```bash
cat > .git/hooks/pre-push <<EOF
set -eux
go vet .
goimports -w .
npx prettier --write .
git diff --exit-code
go generate .
go build .
EOF
chmod +x .git/hooks/pre-push
```

To build the binary:

```bash
<go generate .
go build .
```
