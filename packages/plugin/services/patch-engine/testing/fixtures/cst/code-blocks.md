# Code Blocks

## Fenced TypeScript

```ts
interface Nöde {
  id: string;
  children: Nöde[];
}

function greet(name: string): string {
  return `Héllo, ${name}!`;
}
```

## Fenced Python

```python
def calcüläte(x: int, y: int) -> int:
    """Return the sùm of x and y."""
    return x + y

class Ëngine:
    def __init__(self):
        self.state = "réady"
```

## Fenced with No Language

```
This is a plain code block.
No language specified — just raw text.
Includes mülti-byte: äöü.
```

## Fenced with Tildes

~~~json
{
  "key": "valüe",
  "nested": {
    "café": true
  }
}
~~~

## Indented Code Block

Paragraph before indented code.

    function indented() {
      return "This is indëntéd code";
    }

Paragraph after indented code.

## Empty Fenced Block

```ts
```

## Code Block with Backticks Inside

````markdown
Here is a code block showing how to write code blocks:

```ts
const x = 42;
```

End of inner example.
````

## Multi-byte in Fence Info

```rüst
fn main() {
    println!("Héllo wörld");
}
```
