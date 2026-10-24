const COC_PROXY = 'https://cocproxy.royaleapi.dev/v1';
const COMMUNITY_API = 'https://api.clashk.ing/v2';
const ALLOWED_BASES = new Set([COC_PROXY, 'https://api.clashofclans.com/v1']);
const MAX_BYTES = 2 * 1024 * 1024;

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function normalizeTag(input) {
  const tag = `#${String(input ?? '').trim().toUpperCase().replace(/^#/, '')}`;
  if (!/^#[0289PYLQGRJCUV]{3,15}$/.test(tag)) {
    throw new ApiError(400, 'invalid_tag', 'Enter the player tag shown beneath your name in Clash of Clans.');
  }
  return tag;
}

export function configuration() {
  const token = process.env.COC_API_TOKEN?.trim();
  const supplied = (process.env.COC_API_BASE_URL || COC_PROXY).replace(/\/+$/, '');
  return { token, baseUrl: ALLOWED_BASES.has(supplied) ? supplied : COC_PROXY };
}

export function apiResponse(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export function errorResponse(error) {
  const known = error instanceof ApiError;
  return apiResponse({
    error: known ? error.message : 'The game-data service is temporarily unavailable. Try again shortly.',
    code: known ? error.code : 'upstream_unavailable',
  }, known ? error.status : 502);
}

async function boundedJSON(response) {
  if (Number(response.headers.get('content-length') || 0) > MAX_BYTES) {
    await response.body?.cancel();
    throw new ApiError(502, 'response_too_large', 'The provider returned too much history. Try refreshing later.');
  }
  if (!response.body) throw new ApiError(502, 'invalid_response', 'The game-data service returned an empty response.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0, text = '';
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > MAX_BYTES) {
        await reader.cancel();
        throw new ApiError(502, 'response_too_large', 'The provider returned too much history. Try refreshing later.');
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(502, 'invalid_response', 'The game-data service returned an unreadable response.');
  } finally {
    reader.releaseLock();
  }
}

async function providerGet(url, { token, fetcher = fetch } = {}) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  let response;
  try {
    response = await fetcher(url, { headers, signal: AbortSignal.timeout(10_000), redirect: 'manual' });
  } catch (error) {
    const timeout = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    throw new ApiError(timeout ? 504 : 502, timeout ? 'provider_timeout' : 'provider_connection', timeout ? 'The game-data service did not respond in time. Try again.' : 'Could not connect to the game-data provider. Try again shortly.');
  }
  if (response.status >= 300 && response.status < 400) {
    await response.body?.cancel();
    throw new ApiError(502, 'unexpected_redirect', 'The game-data provider returned an unexpected redirect. Try again later.');
  }
  if (!response.ok) {
    await response.body?.cancel();
    const errors = {
      400: ['invalid_request', 'The provider could not read this player tag.'],
      401: ['api_key_rejected', 'The game API key was rejected. The site owner needs to update the server connection.'],
      403: ['api_key_rejected', 'The game API key or allowed IP was rejected. Allow 45.79.218.79 for the RoyaleAPI proxy.'],
      404: ['not_found', 'That player or battle history was not found. Check the tag and try again.'],
      429: ['rate_limited', 'The provider is receiving too many requests. Wait a moment before refreshing.'],
      503: ['maintenance', 'The game or history provider is temporarily unavailable. Try again later.'],
    };
    const [code, message] = errors[response.status] || ['upstream_unavailable', 'The game-data service is temporarily unavailable.'];
    throw new ApiError(response.status, code, message);
  }
  return boundedJSON(response);
}

function officialGet(path, config, fetcher) {
  if (!config.token) throw new ApiError(503, 'setup_required', 'Automatic lookup is waiting for the site owner to connect a Clash of Clans API key.');
  if (!ALLOWED_BASES.has(config.baseUrl)) throw new ApiError(503, 'invalid_configuration', 'The game-data connection needs to be configured by the site owner.');
  return providerGet(`${config.baseUrl}${path}`, { token: config.token, fetcher });
}

function communityGet(path, fetcher) {
  // The official API credential is never sent to the community-history service.
  return providerGet(`${COMMUNITY_API}${path}`, { fetcher });
}

export async function getPlayer(input, options = {}) {
  const tag = normalizeTag(input);
  const config = options.config || configuration();
  const data = await officialGet(`/players/${encodeURIComponent(tag)}`, config, options.fetcher);
  if (!data || typeof data.tag !== 'string' || data.tag.toUpperCase() !== tag || typeof data.name !== 'string' || !data.name.trim() || !Number.isInteger(data.townHallLevel) || data.townHallLevel < 1) {
    throw new ApiError(502, 'invalid_profile', 'The provider did not return a valid player profile.');
  }
  return data;
}

export function parseBattleDate(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const expanded = value.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6');
  const date = new Date(expanded);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

const finite = (value) => typeof value === 'number' && Number.isFinite(value) ? value : null;
const nonnegative = (value) => finite(value) !== null && value >= 0 ? value : null;

function resources(value) {
  if (Array.isArray(value)) {
    const items = new Map(value.map(r => [String(r?.name || '').toLowerCase().replace(/[^a-z]/g, ''), nonnegative(r?.amount)]));
    return { gold: items.get('gold') ?? null, elixir: items.get('elixir') ?? null, dark: items.get('darkelixir') ?? null };
  }
  if (value && typeof value === 'object') {
    return { gold: nonnegative(value.gold), elixir: nonnegative(value.elixir), dark: nonnegative(value.darkElixir ?? value.dark) };
  }
  return { gold: null, elixir: null, dark: null };
}

function battleMode(value) {
  const raw = String(value || '').toLowerCase();
  if (/legend/.test(raw)) return 'legend';
  if (/rank/.test(raw)) return 'ranked';
  if (/cwl|warleague/.test(raw)) return 'cwl';
  if (/war/.test(raw)) return 'war';
  if (/farm|multiplayer|home/.test(raw)) return 'farming';
  if (/friendly/.test(raw)) return 'friendly';
  return 'other';
}

export function normalizeBattles(payload, tag, source = 'official') {
  const items = Array.isArray(payload) ? payload : Array.isArray(payload?.items) ? payload.items : [];
  return items.slice(0, 1000).flatMap(entry => {
    if (!entry || typeof entry !== 'object') return [];
    const date = parseBattleDate(entry.battleTimestamp ?? entry.time ?? (typeof entry.battleTime === 'string' ? entry.battleTime : null));
    if (!date) return [];
    const mode = battleMode(entry.battleType ?? entry.battleMode);
    const attack = entry.attack !== false;
    const types = { ranked:'Ranked', legend:'Legend', farming:'Multiplayer', war:'Clan war', cwl:'CWL', friendly:'Friendly', other:'Other' };
    const loot = resources(entry.lootedResources);
    const opponent = typeof entry.opponentName === 'string' ? entry.opponentName : typeof entry.opponent?.name === 'string' ? entry.opponent.name : null;
    const opponentTag = typeof entry.opponentPlayerTag === 'string' ? entry.opponentPlayerTag : typeof entry.opponent?.tag === 'string' ? entry.opponent.tag : null;
    const duration = nonnegative(entry.duration ?? (typeof entry.battleTime === 'number' ? entry.battleTime : null));
    const trophyChange = finite(entry.trophies ?? entry.trophyChange);
    return [{
      id: `observed:${tag}:${date}:${attack ? 'attack' : 'defense'}:${mode}`,
      opponent: opponent || (mode === 'farming' ? 'Farming raid' : `${types[mode]} ${attack ? 'attack' : 'defense'}`),
      opponentKnown: !!opponent,
      opponentTag,
      type: attack ? types[mode] : 'Defense',
      mode,
      townHall: nonnegative(entry.opponentTownHallLevel ?? entry.opponent?.townHallLevel),
      stars: Number.isInteger(entry.stars) && entry.stars >= 0 && entry.stars <= 3 ? entry.stars : null,
      destruction: nonnegative(entry.destructionPercentage) !== null && entry.destructionPercentage <= 100 ? entry.destructionPercentage : null,
      gold: loot.gold,
      elixir: loot.elixir,
      dark: loot.dark,
      bonus: resources(entry.extraLootedResources),
      trophyChange,
      duration,
      date,
      armyShareCode: typeof (entry.armyShareCode ?? entry.shareCode) === 'string' ? (entry.armyShareCode ?? entry.shareCode).slice(0, 4000) : null,
      familyId: typeof entry.familyId === 'string' ? entry.familyId : null,
      notes: '',
      demo: false,
      source,
    }];
  });
}

function mergeBattle(previous, next) {
  if (!previous) return next;
  const combined = { ...previous, ...next };
  for (const key of ['townHall', 'stars', 'destruction', 'gold', 'elixir', 'dark', 'trophyChange', 'duration', 'opponentTag', 'armyShareCode', 'familyId']) {
    combined[key] = next[key] ?? previous[key] ?? null;
  }
  if (!next.opponentKnown && previous.opponentKnown) {
    combined.opponent = previous.opponent;
    combined.opponentKnown = true;
  }
  return combined;
}

function normalizeGroup(data, tag, mode) {
  const members = Array.isArray(data?.members) ? data.members : [];
  const own = members.find(m => (m.playerTag ?? m.tag) === tag);
  const score = finite(own?.leagueTrophies ?? own?.trophies);
  const position = own && score !== null ? 1 + members.filter(m => finite(m.leagueTrophies ?? m.trophies) !== null && (m.leagueTrophies ?? m.trophies) > score).length : null;
  const entries = [
    ...(Array.isArray(data?.attackLogs) ? data.attackLogs.map(e => ({ ...e, attack: true })) : []),
    ...(Array.isArray(data?.defenseLogs) ? data.defenseLogs.map(e => ({ ...e, attack: false })) : []),
  ].map(e => ({ ...e, battleType: mode, battleTimestamp: e.creationTime }));
  return { position, trophies: score, members: members.length, battles: normalizeBattles(entries, tag, 'official') };
}

function outcome(result, source) {
  if (result.status === 'fulfilled') return { status: 'available', source };
  return { status: result.reason?.code === 'not_found' ? 'not_recorded' : 'unavailable', source, message: result.reason instanceof ApiError ? result.reason.message : 'This data source is temporarily unavailable.' };
}

export async function getActivity(input, options = {}) {
  const tag = normalizeTag(input), encoded = encodeURIComponent(tag);
  const config = options.config || configuration(), fetcher = options.fetcher;
  const after = new Date(Date.now() - 14 * 86400000).toISOString();
  const tasks = [
    () => officialGet(`/players/${encoded}/battlelog`, config, fetcher),
    () => communityGet(`/player/${encoded}/rankings`, fetcher),
    () => communityGet(`/player/${encoded}/battlelog/history?time%5Bafter%5D=${encodeURIComponent(after)}`, fetcher),
    () => officialGet(`/players/${encoded}/leaguehistory`, config, fetcher),
    () => communityGet(`/player/${encoded}/league/history?time%5Bafter%5D=${encodeURIComponent(after)}`, fetcher),
  ];
  const hasGroup = options.groupTag && options.groupTag !== '#0' && Number.isInteger(options.seasonId) && options.seasonId > 0 && options.seasonId < 2_000_000_000;
  if (hasGroup) {
    const group = normalizeTag(options.groupTag);
    tasks.push(() => officialGet(`/leaguegroup/${encodeURIComponent(group)}/${options.seasonId}?playerTag=${encoded}`, config, fetcher));
  }
  const results = await Promise.allSettled(tasks.map(task => Promise.resolve().then(task)));
  const [recent, rankings, stored, officialLeagues, communityLeagues] = results;
  const group = hasGroup && results[5]?.status === 'fulfilled' ? normalizeGroup(results[5].value, tag, options.groupMode === 'legend' ? 'legend' : 'ranked') : null;
  const battles = new Map();
  if (stored.status === 'fulfilled') for (const b of normalizeBattles(stored.value, tag, 'clashking')) battles.set(b.id, b);
  if (group) for (const b of group.battles) battles.set(b.id, mergeBattle(battles.get(b.id), b));
  if (recent.status === 'fulfilled') for (const b of normalizeBattles(recent.value, tag, 'official')) battles.set(b.id, mergeBattle(battles.get(b.id), b));
  const recentState = outcome(recent, 'Supercell API');
  if (recent.status === 'fulfilled' && !normalizeBattles(recent.value, tag).length) recentState.status = 'empty';
  if (group?.battles.length) { recentState.status = 'available'; delete recentState.message; }
  const historyState = outcome(stored, 'ClashKing');
  if (stored.status === 'fulfilled' && !normalizeBattles(stored.value, tag, 'clashking').length) historyState.status = 'empty';
  const leagueHistory = officialLeagues.status === 'fulfilled'
    ? (Array.isArray(officialLeagues.value) ? officialLeagues.value : officialLeagues.value?.items || [])
    : communityLeagues.status === 'fulfilled' ? communityLeagues.value?.items || [] : [];
  return {
    tag,
    fetchedAt: new Date().toISOString(),
    battles: [...battles.values()].sort((a, b) => new Date(b.date) - new Date(a.date)),
    rankings: rankings.status === 'fulfilled' ? rankings.value : null,
    currentGroup: group ? { position: group.position, trophies: group.trophies, members: group.members } : null,
    leagueHistory: leagueHistory.slice(0, 60),
    coverage: {
      recent: recentState,
      history: historyState,
      rankings: outcome(rankings, 'ClashKing'),
      leagues: outcome(officialLeagues.status === 'fulfilled' ? officialLeagues : communityLeagues, officialLeagues.status === 'fulfilled' ? 'Supercell API' : 'ClashKing'),
    },
  };
}
