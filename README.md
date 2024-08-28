# slidev-addon-ws-syncho

Web socket synchro component for [sli.dev](https://sli.dev/) To support slide synchronisation when deploying your slides on github page. 


You have to deploy the following [web socket server](https://github.com/barais/slidev-slide-synchro-server)

```md
---
layout: default
addons:
    - slidev-addon-ws-syncho
wsSettings:
  server: ws://localhost:8080
  updateCursor: true # To send cursor update notification
---

```



## Installation

```bash
npm i slidev-addon-ws-syncho
```

### Usage

-   Define this addon in `frontmatter`

```yaml
layout: default
addons:
    - slidev-addon-ws-syncho
wsSettings:
  server: ws://localhost:8080
#  updateCursor: true # To send cursor update notification
```



## Components

Put your component in one of the global layer component of your presentation. 

```vue
<!-- global-bottom.vue -->
<template>
    <WsSynchro/>
</template>

```

