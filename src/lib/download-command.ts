function shellQuote(value: string) {
  return `'${value.replaceAll("'", "'\\''")}'`
}

export function downloadFileName(value: string, fallback = 'download') {
  return value.split(/[\\/]/).filter(Boolean).at(-1) || fallback
}

export function createWgetDownloadCommand(downloadUrl: string, outputName: string) {
  return `wget ${shellQuote(downloadUrl)} -O ${shellQuote(downloadFileName(outputName))}`
}
