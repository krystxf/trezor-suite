import { Url } from './types';

const GITHUB_REPO_INFO = {
    owner: 'trezor',
    repo: 'trezor-suite',
} as const;

export const GITHUB_REPO_URL: Url =
    `https://github.com/${GITHUB_REPO_INFO.owner}/${GITHUB_REPO_INFO.repo}` as const;
export const GITHUB_API_REPO_URL: Url =
    `https://api.github.com/repos/${GITHUB_REPO_INFO.owner}/${GITHUB_REPO_INFO.repo}` as const;

export const GITHUB_ROADMAP_URL: Url = 'https://github.com/orgs/trezor/projects/28?fullscreen=true';
export const GITHUB_FW_COMMIT_URL: Url = 'https://github.com/trezor/trezor-firmware/commit/';
export const GITHUB_FW_BINARIES_URL: Url =
    'https://github.com/trezor/webwallet-data/tree/master/firmware';
export const GITHUB_BRIDGE_CHANGELOG_URL: Url =
    'https://github.com/trezor/trezord-go/blob/master/CHANGELOG.md';
