  // Bug pré-existente da v1.0.0: `SolsticeLZ` é referenciado em 7 lugares
  // (Snapshots/Workspace/Share/Export) mas nunca foi declarado no escopo da IIFE.
  // Resultado: ReferenceError em runtime → Salvar Snapshot/Workspace persist/Share falham silenciosamente.
  // Fix: alias direto pro LZString (compressToBase64/decompressFromBase64/compress/decompress).
  const SolsticeLZ = (typeof LZString !== 'undefined') ? LZString : {
    compressToBase64: s => s, decompressFromBase64: s => s,
    compress: s => s, decompress: s => s,
    compressToEncodedURIComponent: s => s, decompressFromEncodedURIComponent: s => s
  };
