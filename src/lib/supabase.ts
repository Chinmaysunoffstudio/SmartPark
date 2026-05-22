import { createClient } from '@supabase/supabase-js';

const supabaseUrlRaw = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Sanitize URL by removing /rest/v1/ suffix if present
const supabaseUrl = supabaseUrlRaw?.replace(/\/rest\/v1\/?$/, '');

const isPlaceholder = (url: string | undefined): boolean => {
  if (!url) return true;
  const s = url.toLowerCase();
  return (
    s.includes('placeholder') ||
    s.includes('your-') ||
    s.includes('example') ||
    s.includes('invalid') ||
    s.includes('change-me') ||
    s.length < 10
  );
};

// Try initializing real Supabase if keys are provided
let realSupabase: any = null;
const savedFallback = typeof window !== 'undefined' && localStorage.getItem('parkprecision_use_fallback') === 'true';
let useLocalFallback = savedFallback || isPlaceholder(supabaseUrl) || isPlaceholder(supabaseAnonKey);

if (!useLocalFallback) {
  try {
    realSupabase = createClient(supabaseUrl, supabaseAnonKey);
  } catch (err) {
    console.warn('Real Supabase initialization failed, enabling mock driver:', err);
    useLocalFallback = true;
  }
} else {
  console.log('Using robust client-side LocalStorage DB fallback.');
}

// Global active real-time listeners for updates
const activeListeners: MockChannel[] = [];

const triggerListeners = (tableName: string, eventType: string, newData: any) => {
  setTimeout(() => {
    for (const listener of activeListeners) {
      for (const cb of listener.callbacks) {
        if (cb.table === tableName) {
          if (cb.filter) {
            const parts = cb.filter.split('=eq.');
            const col = parts[0];
            const val = parts[1];
            if (col && val && String(newData[col]) !== val) {
              continue;
            }
          }
          try {
            cb.callback({
              new: newData,
              old: eventType === 'DELETE' ? newData : {},
              eventType,
              schema: 'public',
              table: tableName,
              commit_timestamp: new Date().toISOString()
            });
          } catch (e) {
            console.error('Error triggering real-time callback:', e);
          }
        }
      }
    }
  }, 0);
};

// Seeding standard data for Pune Malls to replicate SQL seeder
const PUNE_MALLS_FALLBACK = [
  { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', name: 'Phoenix Marketcity', address: 'Viman Nagar, Pune', lat: 18.5622, lng: 73.9167, total_slots: 300, levels: ['B1', 'B2', 'L1'] },
  { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', name: 'Amanora Mall', address: 'Hadapsar, Pune', lat: 18.5186, lng: 73.9341, total_slots: 400, levels: ['L1', 'L2', 'L3', 'L4'] },
  { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', name: 'Seasons Mall', address: 'Magarpatta, Pune', lat: 18.5198, lng: 73.9312, total_slots: 300, levels: ['B1', 'B2', 'L1'] },
  { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', name: 'Pavillion Mall', address: 'Senapati Bapat Rd, Pune', lat: 18.5348, lng: 73.8291, total_slots: 200, levels: ['B1', 'B2'] },
  { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15', name: 'Westend Mall', address: 'Aundh, Pune', lat: 18.5601, lng: 73.8031, total_slots: 200, levels: ['B1', 'L1'] }
];

export const initializeLocalStorageDatabase = () => {
  const locKey = 'parkprecision_db_locations';
  const slotsKey = 'parkprecision_db_slots';
  const profilesKey = 'parkprecision_db_profiles';
  const bookingsKey = 'parkprecision_db_bookings';
  const usersKey = 'parkprecision_db_users';

  if (!localStorage.getItem(locKey)) {
    localStorage.setItem(locKey, JSON.stringify(PUNE_MALLS_FALLBACK));
  }

  if (!localStorage.getItem(slotsKey)) {
    const seededSlots: any[] = [];
    for (const mall of PUNE_MALLS_FALLBACK) {
      for (const lvl of mall.levels) {
        const sections = ['A', 'B'];
        for (const sec of sections) {
          for (let i = 1; i <= 8; i++) {
            seededSlots.push({
              id: `${mall.id}-${lvl}-${sec}-${i}`,
              location_id: mall.id,
              slot_number: `${lvl}-${sec}${String(i).padStart(2, '0')}`,
              level: lvl,
              section: sec,
              is_available: Math.random() > 0.25,
              type: 'standard',
              created_at: new Date().toISOString()
            });
          }
        }
      }
    }
    localStorage.setItem(slotsKey, JSON.stringify(seededSlots));
  }

  if (!localStorage.getItem(profilesKey)) {
    localStorage.setItem(profilesKey, JSON.stringify([]));
  }
  if (!localStorage.getItem(bookingsKey)) {
    localStorage.setItem(bookingsKey, JSON.stringify([]));
  }
  if (!localStorage.getItem(usersKey)) {
    localStorage.setItem(usersKey, JSON.stringify([]));
  }
};

const enableLocalFallback = () => {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('parkprecision_use_fallback', 'true');
    } catch (e) {
      console.warn('Could not save fallback state to local storage:', e);
    }
  }
  if (!useLocalFallback) {
    console.warn('Network issue detected. Dynamically falling back to client-side database...');
    useLocalFallback = true;
    initializeLocalStorageDatabase();
  }
};

const isFetchError = (err: any): boolean => {
  if (!err) return false;
  const msg = String(err.message || err).toLowerCase();
  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('load failed') ||
    msg.includes('network error') ||
    msg.includes('dns') ||
    msg.includes('cors') ||
    msg.includes('fetch') ||
    msg.includes('network') ||
    msg.includes('typeerror') ||
    msg.includes('null') ||
    msg.includes('undefined')
  );
};

// Fluent Mock Query Builder to mock supabase.from()
class MockQueryBuilder {
  tableName: string;
  filters: ((item: any) => boolean)[] = [];
  sortField: string | null = null;
  sortAscending: boolean = true;

  constructor(tableName: string) {
    this.tableName = tableName;
    initializeLocalStorageDatabase();
  }

  private getData(): any[] {
    const raw = localStorage.getItem(`parkprecision_db_${this.tableName}`);
    return raw ? JSON.parse(raw) : [];
  }

  private saveData(data: any[]) {
    localStorage.setItem(`parkprecision_db_${this.tableName}`, JSON.stringify(data));
  }

  select(columns: string = '*') {
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push((item) => {
      return item[column] === value;
    });
    return this;
  }

  order(column: string, { ascending = true } = {}) {
    this.sortField = column;
    this.sortAscending = ascending;
    return this;
  }

  limit(n: number) {
    return this;
  }

  single() {
    return this.execute().then(res => {
      return {
        data: res.data ? res.data[0] || null : null,
        error: res.data && res.data.length > 0 ? null : { message: 'Row not found' }
      };
    });
  }

  maybeSingle() {
    return this.execute().then(res => {
      return {
        data: res.data ? res.data[0] || null : null,
        error: null
      };
    });
  }

  then(onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) {
    return this.execute().then(onfulfilled, onrejected);
  }

  async execute() {
    try {
      let data = this.getData();
      for (const filter of this.filters) {
        data = data.filter(filter);
      }

      if (this.sortField) {
        const field = this.sortField;
        const asc = this.sortAscending;
        data.sort((a, b) => {
          if (a[field] < b[field]) return asc ? -1 : 1;
          if (a[field] > b[field]) return asc ? 1 : -1;
          return 0;
        });
      }

      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: { message: err.message || String(err) } };
    }
  }

  async insert(rows: any | any[]) {
    try {
      const items = Array.isArray(rows) ? rows : [rows];
      const current = this.getData();
      const newItems = items.map(item => ({
        id: item.id || crypto.randomUUID(),
        created_at: new Date().toISOString(),
        ...item
      }));

      const updated = [...current, ...newItems];
      this.saveData(updated);

      for (const item of newItems) {
        triggerListeners(this.tableName, 'INSERT', item);
      }

      return { data: newItems, error: null };
    } catch (err: any) {
      return { data: null, error: { message: err.message || String(err) } };
    }
  }

  async update(changes: any) {
    try {
      const current = this.getData();
      const updatedRows: any[] = [];
      const updated = current.map(item => {
        let matches = true;
        for (const filter of this.filters) {
          if (!filter(item)) {
            matches = false;
            break;
          }
        }
        if (matches) {
          const merged = { ...item, ...changes };
          updatedRows.push(merged);
          return merged;
        }
        return item;
      });

      this.saveData(updated);

      for (const item of updatedRows) {
        triggerListeners(this.tableName, 'UPDATE', item);
      }

      return { data: updatedRows, error: null };
    } catch (err: any) {
      return { data: null, error: { message: err.message || String(err) } };
    }
  }

  async delete() {
    try {
      const current = this.getData();
      const deletedRows: any[] = [];
      const kept = current.filter(item => {
        let matches = true;
        for (const filter of this.filters) {
          if (!filter(item)) {
            matches = false;
            break;
          }
        }
        if (matches) {
          deletedRows.push(item);
          return false;
        }
        return true;
      });

      this.saveData(kept);

      for (const item of deletedRows) {
        triggerListeners(this.tableName, 'DELETE', item);
      }

      return { data: deletedRows, error: null };
    } catch (err: any) {
      return { data: null, error: { message: err.message || String(err) } };
    }
  }
}

// Adaptive database query builder wrapper
class AdaptiveQueryBuilder {
  tableName: string;
  realBuilder: any;
  mockBuilder: MockQueryBuilder;
  private action: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private mutationData: any = null;

  constructor(tableName: string, realBuilder: any) {
    this.tableName = tableName;
    this.realBuilder = realBuilder;
    this.mockBuilder = new MockQueryBuilder(tableName);
  }

  select(columns?: string) {
    if (this.realBuilder) {
      this.realBuilder = this.realBuilder.select(columns);
    }
    this.mockBuilder.select(columns);
    return this;
  }

  eq(column: string, value: any) {
    if (this.realBuilder) {
      this.realBuilder = this.realBuilder.eq(column, value);
    }
    this.mockBuilder.eq(column, value);
    return this;
  }

  order(column: string, options?: any) {
    if (this.realBuilder) {
      this.realBuilder = this.realBuilder.order(column, options);
    }
    this.mockBuilder.order(column, options);
    return this;
  }

  limit(n: number) {
    if (this.realBuilder) {
      this.realBuilder = this.realBuilder.limit(n);
    }
    this.mockBuilder.limit(n);
    return this;
  }

  insert(data: any | any[]) {
    this.action = 'insert';
    this.mutationData = data;
    if (this.realBuilder) {
      this.realBuilder = this.realBuilder.insert(data);
    }
    return this;
  }

  update(data: any) {
    this.action = 'update';
    this.mutationData = data;
    if (this.realBuilder) {
      this.realBuilder = this.realBuilder.update(data);
    }
    return this;
  }

  delete() {
    this.action = 'delete';
    if (this.realBuilder) {
      this.realBuilder = this.realBuilder.delete();
    }
    return this;
  }

  single() {
    return this.execute('single');
  }

  maybeSingle() {
    return this.execute('maybeSingle');
  }

  then(onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) {
    return this.execute('then').then(onfulfilled, onrejected);
  }

  private async execute(methodName: 'single' | 'maybeSingle' | 'then') {
    if (useLocalFallback) {
      return this.executeMock(methodName);
    }

    try {
      let res;
      if (methodName === 'single') {
        res = await this.realBuilder.single();
      } else if (methodName === 'maybeSingle') {
        res = await this.realBuilder.maybeSingle();
      } else {
        res = await this.realBuilder;
      }

      if (res && res.error && isFetchError(res.error)) {
        enableLocalFallback();
        return this.executeMock(methodName);
      }
      return res;
    } catch (err: any) {
      if (isFetchError(err)) {
        enableLocalFallback();
        return this.executeMock(methodName);
      }
      return { data: null, error: err };
    }
  }

  private async executeMock(methodName: 'single' | 'maybeSingle' | 'then') {
    if (this.action === 'insert') {
      return this.mockBuilder.insert(this.mutationData);
    }
    if (this.action === 'update') {
      return this.mockBuilder.update(this.mutationData);
    }
    if (this.action === 'delete') {
      return this.mockBuilder.delete();
    }

    if (methodName === 'single') {
      return this.mockBuilder.single();
    }
    if (methodName === 'maybeSingle') {
      return this.mockBuilder.maybeSingle();
    }
    return this.mockBuilder.execute();
  }
}

// Mock channel postgres changes listen
class MockChannel {
  channelName: string;
  callbacks: { event: string; schema: string; table: string; filter?: string; callback: Function }[] = [];

  constructor(name: string) {
    this.channelName = name;
  }

  on(event: string, filterObj: any, callback: Function) {
    this.callbacks.push({
      event,
      schema: filterObj.schema || 'public',
      table: filterObj.table,
      filter: filterObj.filter,
      callback
    });
    return this;
  }

  subscribe(statusCallback?: Function) {
    activeListeners.push(this);
    if (statusCallback) {
      setTimeout(() => statusCallback('SUBSCRIBED'), 0);
    }
    return {
      unsubscribe: () => {
        const index = activeListeners.indexOf(this);
        if (index > -1) {
          activeListeners.splice(index, 1);
        }
      }
    };
  }
}

// Adaptive authentication class
class AdaptiveAuth {
  private listeners: Map<string, Function> = new Map();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === 'parkprecision_session') {
          this.triggerStateChange();
        }
      });
    }
    initializeLocalStorageDatabase();
  }

  private triggerStateChange() {
    const session = this.getLocalSession();
    const event = session ? 'SIGNED_IN' : 'SIGNED_OUT';
    this.listeners.forEach((cb) => {
      try {
        cb(event, session);
      } catch (e) {
        console.error(e);
      }
    });
  }

  getLocalSession() {
    try {
      const raw = localStorage.getItem('parkprecision_session');
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  onAuthStateChange(callback: (event: string, session: any) => void) {
    const id = Math.random().toString(36).substring(7);
    this.listeners.set(id, callback);

    const initSession = this.getLocalSession();
    setTimeout(() => {
      try {
        callback(initSession ? 'INITIAL_SESSION' : 'SIGNED_OUT', initSession);
      } catch (e) {
        console.error(e);
      }
    }, 0);

    return {
      data: {
        subscription: {
          unsubscribe: () => {
            this.listeners.delete(id);
          }
        }
      }
    };
  }

  async getSession() {
    if (useLocalFallback) {
      return { data: { session: this.getLocalSession() }, error: null };
    }
    try {
      const res = await realSupabase.auth.getSession();
      if (res.error && isFetchError(res.error)) {
        enableLocalFallback();
        return { data: { session: this.getLocalSession() }, error: null };
      }
      return res;
    } catch (err: any) {
      if (isFetchError(err)) {
        enableLocalFallback();
        return { data: { session: this.getLocalSession() }, error: null };
      }
      return { data: { session: null }, error: err };
    }
  }

  async signUp({ email, password, options }: any) {
    if (useLocalFallback) {
      return this.localSignUp(email, password, options);
    }
    try {
      const res = await realSupabase.auth.signUp({ email, password, options });
      if (res.error && isFetchError(res.error)) {
        enableLocalFallback();
        return this.localSignUp(email, password, options);
      }
      return res;
    } catch (err: any) {
      if (isFetchError(err)) {
        enableLocalFallback();
        return this.localSignUp(email, password, options);
      }
      return { data: { user: null, session: null }, error: err };
    }
  }

  async signInWithPassword({ email, password }: any) {
    if (useLocalFallback) {
      return this.localSignIn(email, password);
    }
    try {
      const res = await realSupabase.auth.signInWithPassword({ email, password });
      if (res.error && isFetchError(res.error)) {
        enableLocalFallback();
        return this.localSignIn(email, password);
      }
      return res;
    } catch (err: any) {
      if (isFetchError(err)) {
        enableLocalFallback();
        return this.localSignIn(email, password);
      }
      return { data: { user: null, session: null }, error: err };
    }
  }

  async signOut() {
    if (useLocalFallback) {
      this.localSignOut();
      return { error: null };
    }
    try {
      const res = await realSupabase.auth.signOut();
      if (res.error && isFetchError(res.error)) {
        enableLocalFallback();
        this.localSignOut();
        return { error: null };
      }
      this.localSignOut();
      return res;
    } catch (err: any) {
      if (isFetchError(err)) {
        enableLocalFallback();
        this.localSignOut();
        return { error: null };
      }
      return { error: err };
    }
  }

  private localSignUp(email: string, password: string, options?: any) {
    try {
      initializeLocalStorageDatabase();
      const usersRaw = localStorage.getItem('parkprecision_db_users');
      const users = usersRaw ? JSON.parse(usersRaw) : [];

      if (users.find((u: any) => u.email.toLowerCase() === email.toLowerCase())) {
        return { data: { user: null, session: null }, error: { message: 'User already exists' } };
      }

      const uid = crypto.randomUUID();
      const newUser = { id: uid, uid, email, password };
      users.push(newUser);
      localStorage.setItem('parkprecision_db_users', JSON.stringify(users));

      const role = sessionStorage.getItem('pending_role') || options?.data?.role || 'user';
      const newProfile = {
        uid: uid,
        email: email,
        role: role,
        "createdAt": new Date().toISOString(),
        created_at: new Date().toISOString()
      };

      const profilesRaw = localStorage.getItem('parkprecision_db_profiles');
      const profiles = profilesRaw ? JSON.parse(profilesRaw) : [];
      profiles.push(newProfile);
      localStorage.setItem('parkprecision_db_profiles', JSON.stringify(profiles));

      const session = {
        access_token: `mock_jwt_token_${uid}`,
        user: { id: uid, uid, email, email_confirmed_at: new Date().toISOString(), user_metadata: { role } }
      };

      localStorage.setItem('parkprecision_session', JSON.stringify(session));
      this.triggerStateChange();

      return { data: { user: session.user, session }, error: null };
    } catch (e: any) {
      return { data: { user: null, session: null }, error: { message: e.message || String(e) } };
    }
  }

  private localSignIn(email: string, password: string) {
    try {
      initializeLocalStorageDatabase();
      const usersRaw = localStorage.getItem('parkprecision_db_users');
      const users = usersRaw ? JSON.parse(usersRaw) : [];

      const found = users.find((u: any) => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
      if (!found) {
        return { data: { user: null, session: null }, error: { message: 'Invalid credentials. User not found, or bad password entered.' } };
      }

      const profilesRaw = localStorage.getItem('parkprecision_db_profiles') || '[]';
      const profiles = JSON.parse(profilesRaw);
      let pObj = profiles.find((p: any) => p.uid === found.id);
      if (!pObj) {
        pObj = {
          uid: found.id,
          email: found.email,
          role: found.email.includes('admin') ? 'admin' : 'user',
          created_at: new Date().toISOString()
        };
        profiles.push(pObj);
        localStorage.setItem('parkprecision_db_profiles', JSON.stringify(profiles));
      }

      const session = {
        access_token: `mock_jwt_token_${found.id}`,
        user: { id: found.id, uid: found.id, email: found.email, user_metadata: { role: pObj.role } }
      };

      localStorage.setItem('parkprecision_session', JSON.stringify(session));
      this.triggerStateChange();

      return { data: { user: session.user, session }, error: null };
    } catch (e: any) {
      return { data: { user: null, session: null }, error: { message: e.message || String(e) } };
    }
  }

  private localSignOut() {
    localStorage.removeItem('parkprecision_session');
    this.triggerStateChange();
  }
}

// Adaptive Supabase client proxy matching standard client
export const supabase = {
  auth: new AdaptiveAuth(),

  from: (tableName: string) => {
    let realBuilder = null;
    if (!useLocalFallback && realSupabase) {
      try {
        realBuilder = realSupabase.from(tableName);
      } catch (err) {
        enableLocalFallback();
      }
    }
    return new AdaptiveQueryBuilder(tableName, realBuilder);
  },

  channel: (channelName: string) => {
    if (!useLocalFallback && realSupabase) {
      try {
        return realSupabase.channel(channelName);
      } catch (err) {
        enableLocalFallback();
      }
    }
    return new MockChannel(channelName);
  }
};
