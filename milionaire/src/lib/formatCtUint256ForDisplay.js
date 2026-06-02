/** Pretty-print `ctUint256` from `getAliceWealth` / `getBobWealth` for UI. */
export function formatCtUint256ForDisplay(ct) {
    if (ct == null) return '';
    const replacer = (_, v) => (typeof v === 'bigint' ? v.toString() : v);
    try {
        return JSON.stringify(ct, replacer, 2);
    } catch {
        return String(ct);
    }
}
