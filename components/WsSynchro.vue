<!--
Put this component in your global layer slides
<WsSynchro />
-->

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { slides } from "#slidev/slides";

import { configs, useNav, slideHeight, useDrawings } from '@slidev/client'
const {
  currentSlideNo,
  isPresenter } = useNav()

const { drauu } = useDrawings()

import { useRouter } from 'vue-router'

import { initSharedState, onPatch as onPatchSlide, patch as patchSlide, SharedState, sharedState as sharedStateSlide } from '@slidev/client/state/shared.ts'
import { DrawingsState, drawingState } from '@slidev/client/state/drawings.ts'
import Hashids from 'hashids';
import type { SlideRoute } from '@slidev/types'
import { skipTransition } from '@slidev/client/logic/hmr.ts'
import { useViewTransition } from '@slidev/client/composables/useViewTransition.ts'

interface DrawingData {
  dump: string;
  slideNo: number;
}




enum ConnectionStatus {
  CONNECTED,
  DISCONNECTED,
  ERROR,
  IDLE,
}

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
  state: DrawingData
}

type SendState = SlideState | DrawState;



defineProps<{
}>()

let webSocket: WebSocket;

const connectState = ref<ConnectionStatus>(ConnectionStatus.DISCONNECTED)
const slideId = ref('')

const lastPage = ref(1)
const lastClick = ref(0)
const dumpDraw = ref('')
const router = useRouter()

const shouldSynchroDrawings = ref(false)

const lasttime = ref(0)
const lastx = ref(0)
const lasty = ref(0)

const hashids = new Hashids();

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
  if (!isPresenter.value) {
    if (lastPage.value !== currentSlideNo.value) {
      nextTick().then(() => {
        setTimeout(() => {
          if (!drauu.mounted) {
            console.error('drauu not mounted')
            return
          }
          if (isPresenter.value) {
            return

          }
          if (dumpDraw.value !== undefined && dumpDraw.value !== '') {
            drauu.load(dumpDraw.value);
          } else {
            drauu.clear();
          }
        }, 50)
      })
      lastPage.value = currentSlideNo.value
      return;

    }
  }
  else {
    const dump1 = drawingState[sharedStateSlide.page]
    if (shouldSynchroDrawings.value && dump1 !== undefined && '' !== dump1 && connectState.value === ConnectionStatus.CONNECTED) {
      const dump = {
        dump: dump1,
        clicks: sharedStateSlide.clicks,
        page: sharedStateSlide.page,
        lastUpdate: sharedStateSlide.lastUpdate,
      };
      webSocket.send(JSON.stringify({
        id: slideId.value,
        state: dump,
        type: "broadcast",
        mtype: SendType.SLIDE
      }))
    } else if (connectState.value === ConnectionStatus.CONNECTED) {
      webSocket.send(JSON.stringify({
        id: slideId.value,
        state: sharedStateSlide,
        type: "broadcast",
        mtype: SendType.SLIDE
      }))

    }

  }
}
router.afterEach(updateSharedState)



onPatchSlide((state: SharedState) => {

  if (isPresenter.value && connectState.value === ConnectionStatus.CONNECTED && state.lastUpdate?.type === 'presenter') {

    if (shouldUpdateCursor()) {
      //      console.error(lastx.value, state.cursor)
      if (lastx.value !== state.cursor?.x || lasty.value !== state.cursor?.y) {
        lastx.value = state.cursor ? state.cursor.x : 0
        lasty.value = state.cursor ? state.cursor.y : 0
        webSocket.send(JSON.stringify({
          id: slideId.value,
          state: state,
          type: "broadcast",
          mtype: SendType.SLIDE
        }))
      }

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




function getWsServer() {
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

function shouldSynchroDrawing() {
  if ((configs as any).wsSettings?.synchroDrawing !== undefined) {
    return (configs as any).wsSettings.synchroDrawing;
  }
  return false;
}






function onMessage(event) {
  const { state, mtype, type } = JSON.parse(event.data) as SendState;
  if (!isPresenter.value) {


    if (mtype === SendType.SLIDE) {
      if (sharedStateSlide.page !== state.page) {
        patchSlide('page', state.page);
        skipTransition.value = false
        router.replace({
          path: getSlidePath(state.page, isPresenter.value),
          query: {
            ...router.currentRoute.value.query,
            clicks: state.clicks || 0,
          },
        })
          .then(() => {
            if (state['dump'] && state['dump'] !== '') {
              //          drauu.load(state['dump']);
              //          patchDraw(state.page, state['dump'])

              nextTick()
              dumpDraw.value = state['dump']

            } else {
              dumpDraw.value = ''

            }

          });
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
    } else if (mtype === SendType.DRAW) {

      const dump = state.dump
      const key = state.slideNo
      const key1 = currentSlideNo.value

      if ((drawingState[key]) !== dump && key1 === key) {
        // patchDraw(key1, dump)
        drauu.load(dump)
      } else if (dump === '' && key1 === key) {
        drauu.clear();
      }

    }
  }
}


function initWebSocket() {
  if (!webSocket) {
    webSocket = new WebSocket(getWsServer());
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
    type: "connect",
    mtype: "slide",

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

function getHash() {
  const slideRaws = slides.value
    .map((route) => (route?.meta?.slide as any).content ?? "")
    .join("\n");
  const slideTitle: string = (slides.value[0].meta.slide as any).title
  return hashids.encode(cyrb53(slideTitle + slideRaws));
}


drauu.on('changed', () => {
  if (!isPresenter.value && connectState.value === ConnectionStatus.CONNECTED)
    return
  if (shouldSynchroDrawings.value) {
    const dump = drauu.dump()
    if (dump !== undefined && dump !== 'undefined') {

      const key = currentSlideNo.value
      webSocket.send(JSON.stringify({
        id: slideId.value,
        state: {
          slideNo: currentSlideNo.value,
          dump: dump
        },
        type: "broadcast",
        mtype: SendType.DRAW
      }))
    }
  }
}
)


onMounted(() => {
  slideId.value = getHash();
  shouldSynchroDrawings.value = shouldSynchroDrawing()


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