/** Pretty-print on-chain `ctUint256` for the UI. */
export function formatCtUint256(ct) {
    if (ct == null) return '';
    const replacer = (_, v) => (typeof v === 'bigint' ? v.toString() : v);
    try {
        return JSON.stringify(ct, replacer, 2);
    } catch {
        return String(ct);
    }
}
