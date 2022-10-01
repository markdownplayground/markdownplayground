# Contributing

Prerequisite:

- Golang
- NPM

To run the server:

```
# *server.bash
go run .
```

To run the UI:

```
# *ui.bash
npm start
```

Lint code:

```
# *lint.bash
go vet .
```

Format code:

```
# *format.bash
goimports -w .
npx prettier --write .
```

To build the binary:

```
# *build.bash
go generate .
go build .
```