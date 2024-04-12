/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable no-console */
import type { DirectiveBinding } from 'vue-demi'
import type { LazyOptions, Lifecycle, ValueFormatterObject } from './types'
import { LifecycleEnum } from './types'
import { assign, hasIntersectionObserver, isObject } from './util'
import { DEFAULT_ERROR, DEFAULT_LOADING } from './constant'

const DEFAULT_OBSERVER_OPTIONS = {
  rootMargin: '0px',
  threshold: 0,
}

const TIMEOUT_ID_DATA_ATTR = 'data-lazy-timeout-id'

/**
 * Lazyload
 *
 * @export
 * @class Lazy
 */
export default class Lazy {
  public options: LazyOptions = {
    loading: DEFAULT_LOADING,
    error: DEFAULT_ERROR,
    observerOptions: DEFAULT_OBSERVER_OPTIONS,
    log: true,
    lifecycle: {},
    logLevel: 'error',
  }

  private _images: WeakMap<HTMLElement, IntersectionObserver> = new WeakMap()

  constructor(options?: LazyOptions) {
    this.config(options)
  }

  /**
   * merge config
   *
   * @param {*} [options={}]
   * @memberof Lazy
   */
  public config(options = {}): void {
    assign(this.options, options)
  }

  /**
   * mount
   *
   * @param {HTMLElement} el
   * @param {DirectiveBinding<string>} binding
   * @memberof Lazy
   */
  public mount(el: HTMLElement, binding: string | DirectiveBinding<string | ValueFormatterObject>): void {
    if (!el)
      return
    const { src, srcset, sizes, loading, error, lifecycle, delay } = this._valueFormatter(typeof binding === 'string' ? binding : binding.value)
    this._lifecycle(LifecycleEnum.LOADING, lifecycle, el)
    el.setAttribute('src', loading || DEFAULT_LOADING)

    if (!hasIntersectionObserver) {
      this.loadImages(el, src, srcset, sizes, error, lifecycle)
      this._log(() => {
        this._logger('Not support IntersectionObserver!')
      })
    }
    this._initIntersectionObserver(el, src, srcset, sizes, error, lifecycle, delay)
  }

  /**
   * update
   *
   * @param {HTMLElement} el
   * @memberof Lazy
   */
  public update(el: HTMLElement, binding: string | DirectiveBinding<string | ValueFormatterObject>): void {
    if (!el)
      return
    this._realObserver(el)?.unobserve(el)
    const { src, srcset, sizes, error, lifecycle, delay } = this._valueFormatter(typeof binding === 'string' ? binding : binding.value)
    this._initIntersectionObserver(el, src, srcset, sizes, error, lifecycle, delay)
  }

  /**
   * unmount
   *
   * @param {HTMLElement} el
   * @memberof Lazy
   */
  public unmount(el: HTMLElement): void {
    if (!el)
      return
    this._realObserver(el)?.unobserve(el)
    this._images.delete(el)
  }

  /**
   * force loading
   *
   * @param {HTMLElement} el
   * @param {string} src
   * @param {string|undefined} srcset
   * @param {string|undefined} sizes
   * @memberof Lazy
   */
  public loadImages(el: HTMLElement, src: string, srcset?: string, sizes?: string, error?: string, lifecycle?: Lifecycle): void {
    this._setImageSrc(el, src, srcset, sizes, error, lifecycle)
  }

  /**
   * set img tag src and srcset attributes
   *
   * @private
   * @param {HTMLElement} el
   * @param {string} src
   * @param {string|undefined} srcset
   * @param {string|undefined} sizes
   * @memberof Lazy
   */
  private _setImageSrc(el: HTMLElement, src: string, srcset?: string, sizes?: string, error?: string, lifecycle?: Lifecycle): void {
    if (el.tagName.toLowerCase() === 'img') {
      if (src) {
        const preSrc = el.getAttribute('src')
        if (preSrc !== src)
          el.setAttribute('src', src)
      }
      if (srcset) {
        const preSrcset = el.getAttribute('srcset')
        if (preSrcset !== srcset)
          el.setAttribute('srcset', srcset)
      }
      console.log(sizes)
      if (sizes) {
        const preSizes = el.getAttribute('sizes')
        if (preSizes !== sizes)
          el.setAttribute('sizes', sizes)
      }

      this._listenImageStatus(el as HTMLImageElement, () => {
        this._lifecycle(LifecycleEnum.LOADED, lifecycle, el)
      }, () => {
        // Fix onload trigger twice, clear onload event
        // Reload on update
        el.onload = null
        this._lifecycle(LifecycleEnum.ERROR, lifecycle, el)
        this._realObserver(el)?.disconnect()
        if (error) {
          const newImageSrc = el.getAttribute('src')
          if (newImageSrc !== error)
            el.setAttribute('src', error)
        }
        this._log(() => { this._logger(`Image failed to load!And failed src was: ${src}; srcset was: ${srcset ?? ''}; sizes were: ${sizes ?? ''}`) })
      })
    }
    else {
      el.style.backgroundImage = `url('${src}')`
    }
  }

  /**
   * init IntersectionObserver
   *
   * @private
   * @param {HTMLElement} el
   * @param {string} src
   * @param {string|undefined} srcset
   * @memberof Lazy
   */
  private _initIntersectionObserver(el: HTMLElement, src: string, srcset?: string, sizes?: string, error?: string, lifecycle?: Lifecycle, delay?: number): void {
    const observerOptions = this.options.observerOptions
    this._images.set(el, new IntersectionObserver((entries) => {
      Array.prototype.forEach.call(entries, (entry) => {
        if (delay && delay > 0)
          this._delayedIntersectionCallback(el, entry, delay, src, srcset, sizes, error, lifecycle)
        else
          this._intersectionCallback(el, entry, src, srcset, sizes, error, lifecycle)
      })
    }, observerOptions))
    this._realObserver(el)?.observe(el)
  }

  private _intersectionCallback(el: HTMLElement, entry: IntersectionObserverEntry, src: string, srcset?: string, sizes?: string, error?: string, lifecycle?: Lifecycle): void {
    if (entry.isIntersecting) {
      this._realObserver(el)?.unobserve(entry.target)
      this._setImageSrc(el, src, srcset, sizes, error, lifecycle)
    }
  }

  private _delayedIntersectionCallback(el: HTMLElement, entry: IntersectionObserverEntry, delay: number, src: string, srcset?: string, sizes?: string, error?: string, lifecycle?: Lifecycle): void {
    if (entry.isIntersecting) {
      if (entry.target.hasAttribute(TIMEOUT_ID_DATA_ATTR))
        return

      const timeoutId = setTimeout(() => {
        this._intersectionCallback(el, entry, src, srcset, sizes, error, lifecycle)
        entry.target.removeAttribute(TIMEOUT_ID_DATA_ATTR)
      }, delay)
      entry.target.setAttribute(TIMEOUT_ID_DATA_ATTR, String(timeoutId))
    }
    else {
      if (entry.target.hasAttribute(TIMEOUT_ID_DATA_ATTR)) {
        clearTimeout(Number(entry.target.getAttribute(TIMEOUT_ID_DATA_ATTR)))
        entry.target.removeAttribute(TIMEOUT_ID_DATA_ATTR)
      }
    }
  }

  /**
   * only listen to image status
   *
   * @private
   * @param image
   * @param {() => void} success
   * @param {() => void} error
   * @memberof Lazy
   */
  private _listenImageStatus(image: HTMLImageElement, success: ((this: GlobalEventHandlers, ev: Event) => any) | null, error: OnErrorEventHandler) {
    image.onload = success
    image.onerror = error
  }

  /**
   * to do it differently for object and string
   *
   * @public
   * @param {(ValueFormatterObject | string)} value
   * @returns {*}
   * @memberof Lazy
   */
  public _valueFormatter(value: ValueFormatterObject | string): ValueFormatterObject {
    if (isObject(value)) {
      const val = value as ValueFormatterObject
      return {
        src: val.src,
        srcset: val.srcset,
        sizes: val.sizes,
        loading: val.loading || this.options.loading,
        error: val.error || this.options.error,
        lifecycle: (val.lifecycle || this.options.lifecycle),
        delay: (val.delay || this.options.delay),
      }
    }

    return {
      src: value as string,
      loading: this.options.loading,
      error: this.options.error,
      lifecycle: this.options.lifecycle,
      delay: this.options.delay,
    }
  }

  /**
   * log
   *
   * @param {() => void} callback
   * @memberof Lazy
   */
  public _log(callback: () => void): void {
    if (this.options.log)
      callback()
  }

  /**
   * lifecycle easy
   *
   * @private
   * @param {LifecycleEnum} life
   * @param {Lifecycle} [lifecycle]
   * @memberof Lazy
   */
  private _lifecycle(life: LifecycleEnum, lifecycle?: Lifecycle, el?: HTMLElement): void {
    switch (life) {
      case LifecycleEnum.LOADING:
        el?.setAttribute('lazy', LifecycleEnum.LOADING)
        if (lifecycle?.loading)
          lifecycle.loading(el)

        break
      case LifecycleEnum.LOADED:
        el?.setAttribute('lazy', LifecycleEnum.LOADED)
        if (lifecycle?.loaded)
          lifecycle.loaded(el)

        break
      case LifecycleEnum.ERROR:
        el?.setAttribute('lazy', LifecycleEnum.ERROR)
        if (lifecycle?.error)
          lifecycle.error(el)

        break
      default:
        break
    }
  }

  private _realObserver(el: HTMLElement): IntersectionObserver | undefined {
    return this._images.get(el)
  }

  private _logger(message?: any, ...optionalParams: any[]) {
    let log = console.error
    switch (this.options.logLevel) {
      case 'error':
        log = console.error
        break
      case 'warn':
        log = console.warn
        break
      case 'info':
        log = console.info
        break
      case 'debug':
        log = console.debug
        break
      default:
        break
    }
    log(message, optionalParams)
  }
}
