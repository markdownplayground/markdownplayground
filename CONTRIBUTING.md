# Contributing

Prerequisite:

- Golang
- NPM

To run the server:

```bash
go run .
```

To run the UI:

```
npm start
```

Lint code:

```
go vet .
```

Format code:

```
goimports -w .
npx prettier --write .
```

To build the binary:

```
go generate .
go build .
```
