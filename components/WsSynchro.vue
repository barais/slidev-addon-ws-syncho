<!--
Put this component in your global layer slides
<WsSynchro />
-->

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { configs } from "@slidev/client";
import { slides } from "#slidev/slides";

import { useNav, slideHeight } from '@slidev/client'
const { clicksContext,
  currentSlideNo,
  hasPrimarySlide,
  isNotesViewer, isPresenter } = useNav()
import { useRouter } from 'vue-router'

import { initSharedState, onPatch as onPatchSlide, patch as patchSlide, SharedState, sharedState as sharedStateSlide } from '@slidev/client/state/shared.ts'
import { onPatchDrawingState as onPatchDraw, patchDrawingState as patchDraw, DrawingsState } from '@slidev/client/state/drawings.ts'
import Hashids from 'hashids';
import type { SlideRoute } from '@slidev/types'
import { skipTransition } from '@slidev/client/logic/hmr.ts'


enum ConnectionStatus {
  CONNECTED,
  DISCONNECTED,
  ERROR,
  IDLE,
}

defineProps<{
}>()

let webSocket: WebSocket;

const connectState = ref<ConnectionStatus>(ConnectionStatus.DISCONNECTED)
const slideId = ref('')

const lastPage = ref(1)
const lastClick = ref(0)
const router = useRouter()

function getSlide(no: number | string) {
  return slides.value.find(
    s => (s.no === +no || (s.meta.slide as any).frontmatter.routeAlias === no)
  )
}
function getSlidePath(
  route: SlideRoute | number | string,
  presenter: boolean,
) {
  if (typeof route === 'number' || typeof route === 'string')
    route = getSlide(route)!
  const no = (route.meta.slide as any).frontmatter.routeAlias ?? route.no
  return presenter ? `/presenter/${no}` : `/${no}`
}

function updateSharedState() {

  if (!isPresenter.value)
    return
  else {
    webSocket.send(JSON.stringify({
      id: slideId.value,
      state: sharedStateSlide,
      type: "broadcast",
      mtype: SendType.SLIDE
    }))
  }
}
router.afterEach(updateSharedState)

onPatchSlide((state: SharedState) => {

  if (isPresenter.value && connectState.value === ConnectionStatus.CONNECTED) {
    if (shouldUpdateCursor()) {
      webSocket.send(JSON.stringify({
        id: slideId.value,
        state: state,
        type: "broadcast",
        mtype: SendType.SLIDE
      }))
    } else {
      delete state.cursor;
      if (lastPage.value !== state.page || lastClick.value !== state.clicks) {
        webSocket.send(JSON.stringify({
          id: slideId.value,
          state: state,
          type: "broadcast",
          mtype: SendType.SLIDE
        })
        )
        lastPage.value = state.page
        lastClick.value = state.clicks
      }

    }
  }
})

onPatchDraw((state: DrawingsState) => {
  console.error('on patch draw', state)
  if (isPresenter.value && connectState.value == ConnectionStatus.CONNECTED) {
    /* webSocket.send(JSON.stringify({
      id: slideId.value,
      state: state,
      type: "broadcast",
      mtype: SendType.DRAW
    }) 
    )*/
    // To complete
  }
})



enum SendType {
  SLIDE = "slide",
  DRAW = "draw"
}


enum DataType {
  CONNECT = "connect",
  BROADCAST = "broadcast",
}

interface SlideState {
  mtype: SendType.SLIDE
  type: 'broadcast'
  state: SharedState
}

interface DrawState {
  mtype: SendType.DRAW
  type: 'broadcast'
  state: DrawingsState
}


type SendState = SlideState | DrawState;


function getPollServer() {
  if ((configs as any).wsSettings?.server) {
    return (configs as any).wsSettings.server.endsWith("/")
      ? (configs as any).wsSettings.server.slice(0, -1)
      : (configs as any).wsSettings.server;

  }

  return "ws://localhost:8080";
}

function shouldUpdateCursor() {
  if ((configs as any).wsSettings?.updateCursor !== undefined) {
    return (configs as any).wsSettings.updateCursor;
  }
  return false;
}




function onMessage(event) {
  const { state, mtype, type } = JSON.parse(event.data) as SendState;
  if (mtype === SendType.SLIDE) {
    if (sharedStateSlide.page !== state.page) {
      skipTransition.value = false
      router.replace({
        path: getSlidePath(state.page, isPresenter.value),
        query: {
          ...router.currentRoute.value.query,
          clicks: state.clicks || 0,
        },
      })
      patchSlide('page', state.page);
    }
    if (sharedStateSlide.clicks !== state.clicks) {
      skipTransition.value = false
      router.replace({
        path: getSlidePath(state.page, isPresenter.value),
        query: {
          ...router.currentRoute.value.query,
          clicks: state.clicks || 0,
        },
      })
      patchSlide('clicks', state.clicks);
    }
    if (state.cursor) {
      patchSlide('cursor', state.cursor);
    }


    // Object.entries(data).forEach(([key, value]) => (pollState[key] = value));
  }
}


function initWebSocket() {
  if (!webSocket) {
    webSocket = new WebSocket(getPollServer());
    webSocket.addEventListener("message", onMessage);
    webSocket.addEventListener("open", onOpen);
    webSocket.addEventListener("close", onClose);
  } else {
    onOpen();
  }
}

function closeWebSocket() {
  if (webSocket) {
    connectState.value = ConnectionStatus.DISCONNECTED;
    webSocket.close()
  } else {
    connectState.value = ConnectionStatus.DISCONNECTED;
  }
}


function onOpen() {
  connectState.value = ConnectionStatus.CONNECTED;
  webSocket.send(JSON.stringify({
    id: slideId.value,
    type: "connect"
  })
  )

}

function onClose() {
  if (connectState.value === ConnectionStatus.IDLE) {
    connectState.value = ConnectionStatus.ERROR;
  } else {
    connectState.value = ConnectionStatus.DISCONNECTED;
  }
}

// https://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript
function cyrb53(str: string, seed = 0) {
  let h1 = 0xdeadbeef ^ seed,
    h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }

  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}
const hashids = new Hashids();

function getHash() {
  const slideRaws = slides.value
    .map((route) => (route?.meta?.slide as any).content ?? "")
    .join("\n");
  const slideTitle: string = (slides.value[0].meta.slide as any).title
  return hashids.encode(cyrb53(slideTitle + slideRaws));
}

onMounted(() => {
  slideId.value = getHash();
  if (isPresenter.value) {
    lastPage.value = sharedStateSlide.page
    lastClick.value = sharedStateSlide.clicks
  }
  initWebSocket();
})

onUnmounted(() => {
  closeWebSocket();
})

</script>

<template>

</template>