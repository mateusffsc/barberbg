export function safeRandomUUID(): string {
  // Usa nativo se disponível
  try {
    // @ts-ignore
    if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') {
      // @ts-ignore
      return (crypto as any).randomUUID();
    }
  } catch (_) {}

  // Usa getRandomValues se disponível para gerar RFC4122 v4
  try {
    // @ts-ignore
    if (typeof crypto !== 'undefined' && typeof (crypto as any).getRandomValues === 'function') {
      const buf = new Uint8Array(16);
      // @ts-ignore
      (crypto as any).getRandomValues(buf);
      // Ajusta bits da versão e variante conforme RFC4122 v4
      buf[6] = (buf[6] & 0x0f) | 0x40; // versão 4
      buf[8] = (buf[8] & 0x3f) | 0x80; // variante
      const toHex = (n: number) => n.toString(16).padStart(2, '0');
      const b = Array.from(buf).map(toHex);
      return `${b[0]}${b[1]}${b[2]}${b[3]}-${b[4]}${b[5]}-${b[6]}${b[7]}-${b[8]}${b[9]}-${b[10]}${b[11]}${b[12]}${b[13]}${b[14]}${b[15]}`;
    }
  } catch (_) {}

  // Fallback simples baseado em Math.random (não criptográfico)
  const rand = (len: number) => {
    let out = '';
    for (let i = 0; i < len; i++) {
      out += Math.floor(Math.random() * 16).toString(16);
    }
    return out;
  };
  return `${rand(8)}-${rand(4)}-4${rand(3)}-${((8 + Math.floor(Math.random() * 4)).toString(16))}${rand(3)}-${rand(12)}`;
}

