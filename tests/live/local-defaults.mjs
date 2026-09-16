import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

export const defaultsPath = path.join(homedir(), '.config', 'pf2e-leveler', 'live.json');

export async function loadLocalDefaults(file = defaultsPath) {
  let text;
  try {
    text = await readFile(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw Error('Cannot read local live-test defaults');
  }
  try {
    const value = JSON.parse(text);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error();
    if (value.url !== undefined && typeof value.url !== 'string') throw Error();
    for (const role of ['gm', 'player']) {
      const account = value[role];
      if (account === undefined) continue;
      if (!account || typeof account !== 'object' || Array.isArray(account)) throw Error();
      for (const key of ['username', 'password']) {
        if (account[key] !== undefined && typeof account[key] !== 'string') throw Error();
      }
      if (
        account.allowBlankPassword !== undefined &&
        typeof account.allowBlankPassword !== 'boolean'
      )
        throw Error();
    }
    return value;
  } catch {
    throw Error('Invalid local live-test defaults; expected JSON with account fields');
  }
}

export function accountDefaults(role, local = {}, env = process.env) {
  const prefix = `LEVELER_${role.toUpperCase()}`;
  const saved = local[role] ?? {};
  const username = env[`${prefix}_USER`] ?? saved.username;
  const sameAccount = username?.trim().toLowerCase() === saved.username?.trim().toLowerCase();
  const allowBlankPassword =
    role === 'player' &&
    (env.LEVELER_PLAYER_ALLOW_BLANK !== undefined
      ? env.LEVELER_PLAYER_ALLOW_BLANK === '1'
      : sameAccount && saved.allowBlankPassword === true);
  const password =
    env[`${prefix}_PASSWORD`] ??
    (sameAccount ? saved.password : undefined) ??
    (allowBlankPassword ? '' : undefined);
  return { username, password, allowBlankPassword };
}

export async function promptAccount(role, local, env, prompts, context) {
  const prefix = `LEVELER_${role.toUpperCase()}`;
  const defaults = accountDefaults(role, local, env);
  const username =
    env[`${prefix}_USER`] ??
    (await prompts.input(
      {
        message: `${role} account name:`,
        default: defaults.username,
      },
      context,
    ));
  const selected = accountDefaults(role, local, { ...env, [`${prefix}_USER`]: username });
  let secret = env[`${prefix}_PASSWORD`];
  if (secret === undefined && role === 'player' && env.LEVELER_PLAYER_ALLOW_BLANK === '1')
    secret = '';
  if (secret === undefined) {
    const hint =
      selected.password === undefined
        ? ''
        : selected.password === ''
          ? ' (Enter uses blank password)'
          : ' (Enter keeps saved password)';
    const entered = await prompts.password(
      { message: `${role} password${hint}:`, mask: '*', toggleMask: false },
      context,
    );
    secret = entered === '' ? (selected.password ?? '') : entered;
  }
  const allowBlankPassword =
    role === 'player' &&
    !secret &&
    (env.LEVELER_PLAYER_ALLOW_BLANK === '1' ||
      (await prompts.confirm(
        {
          message: 'Confirm player account has no password.',
          default: selected.allowBlankPassword,
        },
        context,
      )));
  return { username, password: secret, allowBlankPassword };
}
