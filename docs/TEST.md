# Test

This tool is intended to allow you to build **tutorials** and _documentation_ that is saved into Markdown files.

- Unordered list
    - Indented item
1. Ordered list

Bash:

```bash
echo "Hello world!"
```

Javascript:

```javascript
// hello.js
function yes() {
  console.log("Hello world!");
}
```

Java

```java
// Hello.java
public class Hello {
  public static void main(String[] args) {
    System.out.println("Hello world!");
  }
}
```

Run Java:

```bash
set -eux
javac Hello.java
java -cp . Hello
```

Go:

```go
// Hello.go
package main

func main() {
  println("Hello world!")
}
```

Long running process:

```bash
sleep 3
echo "Hello World!"
```