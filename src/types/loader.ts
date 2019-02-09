import Fragment from '../loader/fragment';

export interface LoaderStats {
    trequest: number
    tfirst: number
    tload: number
    loaded: number
    total: number
    retry: number
    aborted: boolean
}

export interface LoaderCallbacks {
    onSuccess: Function
    onError: Function
    onTimeout: Function
    onProgress?: Function
}

export interface LoaderContext {
    frag: Fragment
    responseType: string
    url: string
    rangeStart?: number
    rangeEnd?: number
}

export interface LoaderInterface {
    load(context: LoaderContext, config: any, callbacks: LoaderCallbacks): void
    abort(): void
}
