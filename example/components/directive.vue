<template>
  <div class="margin" />
  <!-- <img v-lazy="'/example/assets/logo.png'" alt="Vue logo" width="100"> -->
  <h1>Primary</h1>
  <img v-lazy="{ src: errorlazy.src, lifecycle: errorlazy.lifecycle, error: errorlazy.error }" alt="error image" class="image" width="100" />
  <button @click="change">change</button>
  <h1>v-for with src</h1>
  <img v-for="item in defaultImages" v-lazy="{ src: item }" alt="Vue logo" class="image" width="100" />
  <h1>v-for with srcset</h1>
  <img v-for="item in imagesWithSrcsetAndSizes" v-lazy="item" alt="Vue logo" class="image" width="100" />
</template>

<script>
import { reactive } from 'vue'
export default {
  name: 'App',
  setup() {
    const errorlazy = reactive({
      src: '/example/assets/log1o.png',
      error: '12.png',
      lifecycle: {
        loading: () => {
          console.log('image loading')
        },
        error: () => {
          console.log('image error')
        },
        loaded: () => {
          console.log('image loaded')
        }
      }
    })
    const change = () => {
      errorlazy.src = 'https://picsum.photos/300/300'
    }
    return {
      errorlazy,
      change,
      defaultImages: [
        'https://picsum.photos/200/300',
        'https://picsum.photos/300/300',
        'https://picsum.photos/400/300',
        'https://picsum.photos/500/300',
      ],
      imagesWithSrcsetAndSizes: [
        {
          src: 'https://picsum.photos/600/300',
          srcset: 'https://picsum.photos/600/300 600w, https://picsum.photos/700/300 700w, https://picsum.photos/800/300 800w',
          sizes: '(min-width: 600px) 600px, (min-width: 700px) 700px, 800px',
        },
        {
          src: 'https://picsum.photos/900/300',
          srcset: 'https://picsum.photos/900/300 900w, https://picsum.photos/1000/300 1000w, https://picsum.photos/1100/300 1100w',
          sizes: '(min-width: 900px) 900px, (min-width: 1000px) 1000px, 1100px',
        }
      ],
    }
  }
}
</script>

<style scoped>
.margin {
  margin-top: 1000px;
}

.image {
  display: block;
}

.image[lazy="loading"] {
  background: goldenrod;
}

.image[lazy="error"] {
  background: red;
}

.image[lazy="loaded"] {
  background: green;
}
</style>
