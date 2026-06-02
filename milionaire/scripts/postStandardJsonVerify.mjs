/**
 * Submit standard-JSON contract verification with a full Etherscan compiler
 * version string (e.g. v0.8.26+commit.8a97fa7a). Hardhat verify often sends
 * "v0.8.26" only, which explorers reject.
 *
 * Usage:
 *   node scripts/postStandardJsonVerify.mjs pod [address]
 *   node scripts/postStandardJsonVerify.mjs avalanche [address]
 *
 * Env: ETHERSCAN_API_KEY, compile pod first (`npm run compile:pod`)
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as dotenvConfig } from 'dotenv';

dotenvConfig();

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const ETHERSCAN_V2 = 'https://api.etherscan.io/v2/api';
const ETHERSCAN_SOLC = 'v0.8.26+commit.8a97fa7a';
const CONTRACT_FQN = {
    pod: 'contracts/pod/MillionaireComparisonPod.sol:MillionaireComparisonPod',
    avalanche: 'contracts/pod/MillionaireComparisonPod.sol:MillionaireComparisonPod',
};

const NETWORKS = {
    pod: {
        chainId: '11155111',
        label: 'Sepolia',
        explorer: 'https://sepolia.etherscan.io/address/',
        addressEnv: ['VITE_CONTRACT_ADDRESS_SEPOLIA', 'VITE_CONTRACT_ADDRESS'],
    },
    sepolia: {
        chainId: '11155111',
        label: 'Sepolia',
        explorer: 'https://sepolia.etherscan.io/address/',
        addressEnv: ['VITE_CONTRACT_ADDRESS_SEPOLIA', 'VITE_CONTRACT_ADDRESS'],
    },
    avalanche: {
        chainId: '43113',
        label: 'Avalanche Fuji',
        explorer: 'https://testnet.snowtrace.io/address/',
        addressEnv: ['VITE_CONTRACT_ADDRESS_AVALANCHE_FUJI', 'VITE_CONTRACT_ADDRESS'],
    },
};

function findPodBuildInfo() {
    const dir = join(ROOT, 'artifacts-pod/build-info');
    const files = readdirSync(dir).filter(
        (f) => f.endsWith('.json') && !f.endsWith('.output.json'),
    );
    const pod = files.find((f) => f.includes('0_8_26'));
    if (!pod) {
        throw new Error('No pod solc 0.8.26 build-info. Run: npm run compile:pod');
    }
    return join(dir, pod);
}

function resolveAddress(networkCfg, cliAddress) {
    if (cliAddress?.trim()) return cliAddress.trim();
    for (const key of networkCfg.addressEnv) {
        const v = process.env[key]?.trim();
        if (v) return v;
    }
    throw new Error(
        `Pass contract address as 2nd arg or set ${networkCfg.addressEnv.join(' / ')}`,
    );
}

async function pollStatus(chainId, apiKey, guid) {
    for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 5000));
        const url = new URL(ETHERSCAN_V2);
        url.searchParams.set('chainid', chainId);
        url.searchParams.set('module', 'contract');
        url.searchParams.set('action', 'checkverifystatus');
        url.searchParams.set('guid', guid);
        url.searchParams.set('apikey', apiKey);

        const res = await fetch(url);
        const text = await res.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch {
            process.stdout.write('?');
            continue;
        }
        const result = String(data.result ?? '');

        if (result.toLowerCase().includes('pass') && data.status === '1') {
            return { ok: true, result };
        }
        if (
            result.toLowerCase().includes('already verified') ||
            result.toLowerCase().includes('contract source code already verified')
        ) {
            return { ok: true, result };
        }
        if (data.status === '0' && !result.toLowerCase().includes('pending')) {
            return { ok: false, result, data };
        }
        process.stdout.write('.');
    }
    return { ok: false, result: 'timeout' };
}

async function main() {
    const networkKey = (process.argv[2] || '').toLowerCase();
    const network = NETWORKS[networkKey];
    if (!network) {
        console.error('Usage: node scripts/postStandardJsonVerify.mjs <pod|avalanche> [address]');
        process.exit(1);
    }

    const apiKey = process.env.ETHERSCAN_API_KEY?.trim();
    if (!apiKey) {
        console.error('Set ETHERSCAN_API_KEY in .env');
        process.exit(1);
    }

    const address = resolveAddress(network, process.argv[3]);
    const buildInfo = JSON.parse(readFileSync(findPodBuildInfo(), 'utf8'));
    const compilerInput = buildInfo.input;

    const submitUrl = new URL(ETHERSCAN_V2);
    submitUrl.searchParams.set('chainid', network.chainId);
    submitUrl.searchParams.set('module', 'contract');
    submitUrl.searchParams.set('action', 'verifysourcecode');
    submitUrl.searchParams.set('apikey', apiKey);

    const body = new URLSearchParams({
        contractaddress: address,
        sourceCode: JSON.stringify(compilerInput),
        codeformat: 'solidity-standard-json-input',
        contractname: CONTRACT_FQN[networkKey] ?? CONTRACT_FQN.pod,
        compilerversion: ETHERSCAN_SOLC,
        constructorArguments: '',
    });

    console.log(`Verifying MillionaireComparisonPod on ${network.label} (chain ${network.chainId})`);
    console.log('Address:', address);
    console.log('Compiler:', ETHERSCAN_SOLC);

    const submitRes = await fetch(submitUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
    });
    const submitData = await submitRes.json();

    if (submitData.status !== '1' || !submitData.result) {
        console.error('Submit failed:', JSON.stringify(submitData, null, 2));
        process.exit(1);
    }

    const guid = submitData.result;
    console.log('GUID:', guid);
    process.stdout.write('Waiting');

    const outcome = await pollStatus(network.chainId, apiKey, guid);
    console.log('');

    if (outcome.ok) {
        console.log('Verified:', outcome.result);
        console.log(network.explorer + address);
        process.exit(0);
    }

    console.error('Verification failed:', outcome.result);
    if (outcome.data) console.error(JSON.stringify(outcome.data, null, 2));
    process.exit(1);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
