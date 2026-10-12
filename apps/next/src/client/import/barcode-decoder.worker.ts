import { decodeBoardingPass, type DecodeRequest } from './barcode-decode'

self.onmessage = async (event: MessageEvent<DecodeRequest>) => {
  try {
    self.postMessage(await decodeBoardingPass(event.data))
  } catch {
    self.postMessage({ kind: 'none', reason: 'failed' })
  }
}
