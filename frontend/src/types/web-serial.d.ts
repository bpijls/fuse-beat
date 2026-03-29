// Minimal Web Serial API type declarations
interface SerialPortInfo {
  usbVendorId?: number
  usbProductId?: number
}

interface SerialOptions {
  baudRate: number
  dataBits?: number
  stopBits?: number
  parity?: 'none' | 'even' | 'odd'
  bufferSize?: number
  flowControl?: 'none' | 'hardware'
}

interface SerialPort {
  open(options: SerialOptions): Promise<void>
  close(): Promise<void>
  readable: ReadableStream<BufferSource>
  writable: WritableStream<BufferSource>
  getInfo(): SerialPortInfo
}

interface Serial {
  requestPort(options?: { filters?: SerialPortInfo[] }): Promise<SerialPort>
  getPorts(): Promise<SerialPort[]>
}

interface Navigator {
  serial: Serial
}
