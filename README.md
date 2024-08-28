# slidev-addon-stackblitz

Stackblitz component for [sli.dev](https://sli.dev/)

![example](https://raw.githubusercontent.com/barais/slidev-addon-stackblitz/main/example-export/001.png)

```md
---
layout: default
addons:
    - slidev-addon-stackblitz
---

<div class="grid w-full">

<Stackblitz id="angular-druxxd" file="src%2Fmain.ts" width="100%" height="450"/>

</div>
```

## Installation

```bash
npm i slidev-addon-stackblitz
```

### Usage

-   Define this addon in `frontmatter`

```yaml
addons:
    - slidev-addon-stackblitz
```

-   or in `package.json`

```json
 "slidev": {
    "addons": [
      "slidev-addon-stackblitz"
    ]
  },
```

## Components

### QRCode

```vue
<Stackblitz id="angular-druxxd" file="src%2Fmain.ts" width="100%" height="450"/>
```


