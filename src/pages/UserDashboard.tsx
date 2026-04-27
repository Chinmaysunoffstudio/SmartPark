import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { ParkingLocation, ParkingSlot, Booking } from '../types';
import { PUNE_MALLS } from '../lib/constants';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell,
  Filter,
  Home,
  MapPin, 
  CheckCircle2, 
  QrCode as QrIcon, 
  Clock, 
  CreditCard, 
  ArrowLeft, 
  Search, 
  ChevronRight, 
  BookmarkCheck,
  History,
  Smartphone,
  ShieldCheck,
  Zap,
  Sun,
  Moon
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

enum UserView {
  MAIN = 'MAIN',
  LOCATIONS = 'LOCATIONS',
  SLOTS = 'SLOTS',
  PAYMENT = 'PAYMENT',
  HISTORY = 'HISTORY',
  SUCCESS = 'SUCCESS',
  PROFILE = 'PROFILE'
}

export default function UserDashboard() {
  const { profile } = useAuth();
  const [currentView, setCurrentView] = useState<UserView>(UserView.MAIN);
  const [locations, setLocations] = useState<ParkingLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<ParkingLocation | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [slots, setSlots] = useState<ParkingSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<ParkingSlot | null>(null);
  const [activeBookings, setActiveBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'upi'>('card');
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' || document.body.classList.contains('dark');
    }
    return false;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const filteredLocations = locations.filter(loc => 
    loc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    loc.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Seed Pune Malls if empty or incomplete (Migration to Supabase)
  const seedMalls = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    console.log('Starting seed process...');
    try {
      const { data: existingMalls, error: fetchError } = await supabase.from('locations').select('name');
      if (fetchError) throw fetchError;

      const existingNames = existingMalls?.map(m => m.name) || [];
      console.log('Existing locations found:', existingNames.length);

      // If we have missing malls, seed them
      if (existingNames.length < PUNE_MALLS.length) {
        console.log('Database under-populated, syncing missing malls...');
        
        for (const mall of PUNE_MALLS) {
          if (existingNames.includes(mall.name)) continue;

          console.log(`Inserting location: ${mall.name}`);
          const { data: locData, error: locError } = await supabase
            .from('locations')
            .insert({
              name: mall.name,
              address: mall.address,
              lat: mall.lat,
              lng: mall.lng,
              total_slots: mall.slots || 100,
              levels: mall.levels,
              admin_id: profile?.uid || null,
              created_at: new Date().toISOString()
            })
            .select()
            .single();

          if (locError) {
            console.error(`Error for ${mall.name}:`, locError.message);
            continue;
          }

          if (locData) {
            // 100 slots per layer (A, B, C, D sections, 25 each)
            const SECTIONS = ["A", "B", "C", "D"];
            const allSlots = [];
            for (const level of mall.levels) {
              for (const section of SECTIONS) {
                for (let i = 1; i <= 25; i++) {
                  allSlots.push({
                    location_id: locData.id,
                    slot_number: `${level}-${section}${i.toString().padStart(2, '0')}`,
                    level: level,
                    section: section,
                    is_available: Math.random() > 0.2,
                    type: 'standard'
                  });
                }
              }
            }
            const { error: slotsError } = await supabase.from('slots').insert(allSlots);
            if (slotsError) console.error(`Slots error for ${mall.name}:`, slotsError.message);
          }
        }
        
        // Final refresh of local state
        const { data: finalLocs } = await supabase.from('locations').select('*').order('name');
        if (finalLocs) setLocations(finalLocs);
      } else {
        console.log('Database fully synced, skipping seed.');
      }
    } catch (err) {
      console.error('Seeding process failed:', err);
      setError(err instanceof Error ? err.message : 'Database synchronization failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile && locations.length === 0) {
      seedMalls();
    }
  }, [profile, locations.length]);

  // Sync Locations
  useEffect(() => {
    const fetchLocations = async () => {
      const { data } = await supabase.from('locations').select('*');
      if (data) setLocations(data.map(item => ({
        ...item,
        totalSlots: item.total_slots,
        adminId: item.admin_id,
        createdAt: item.created_at
      })));
    };
    fetchLocations();

    const subscription = supabase
      .channel('locations_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'locations' }, fetchLocations)
      .subscribe();

    return () => { subscription.unsubscribe(); };
  }, []);

  // Sync User History
  useEffect(() => {
    if (!profile) return;
    const fetchBookings = async () => {
      const { data } = await supabase
        .from('bookings')
        .select('*')
        .eq('user_id', profile.uid);
      
      if (data) setActiveBookings(data.map(item => ({
        ...item,
        userId: item.user_id,
        locationId: item.location_id,
        slotId: item.slot_id,
        startTime: item.start_time,
        endTime: item.end_time,
        qrData: item.qr_data,
        createdAt: item.created_at
      })));
    };
    fetchBookings();

    const subscription = supabase
      .channel(`bookings_${profile.uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `user_id=eq.${profile.uid}` }, fetchBookings)
      .subscribe();

    return () => { subscription.unsubscribe(); };
  }, [profile]);

  // Set initial level
  useEffect(() => {
    if (selectedLocation) {
      if (selectedLocation.levels && selectedLocation.levels.length > 0) {
        setSelectedLevel(selectedLocation.levels[0]);
      } else {
        setSelectedLevel('Ground');
      }
    } else {
      setSelectedLevel(null);
    }
  }, [selectedLocation]);

  // Sync Slots
  useEffect(() => {
    if (!selectedLocation || !selectedLevel) {
      setSlots([]);
      return;
    }

    const fetchSlots = async () => {
      const { data } = await supabase
        .from('slots')
        .select('*')
        .eq('location_id', selectedLocation.id)
        .eq('level', selectedLevel);
      if (data) setSlots(data.map(item => ({
        ...item,
        locationId: item.location_id,
        slotNumber: item.slot_number,
        isAvailable: item.is_available
      })));
    };
    fetchSlots();

    const subscription = supabase
      .channel(`slots_${selectedLocation.id}_${selectedLevel}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'slots', 
        filter: `location_id=eq.${selectedLocation.id}` 
      }, fetchSlots)
      .subscribe();

    return () => { subscription.unsubscribe(); };
  }, [selectedLocation, selectedLevel]);

  const handleProcessPayment = async () => {
    if (!profile || !selectedSlot || !selectedLocation) return;
    setLoading(true);
    await new Promise(r => setTimeout(r, 2000));
    
    try {
      const bookingData = {
        user_id: profile.uid,
        location_id: selectedLocation.id,
        slot_id: selectedSlot.id,
        start_time: new Date().toISOString(),
        end_time: new Date(Date.now() + 3600000 * 3).toISOString(),
        status: 'active',
        qr_data: `PN_PK_${Math.random().toString(36).substring(7).toUpperCase()}`,
        created_at: new Date().toISOString(),
      };
      
      const { error: bookingError } = await supabase.from('bookings').insert([bookingData]);
      if (bookingError) throw bookingError;

      const { error: slotError } = await supabase
        .from('slots')
        .update({ is_available: false })
        .eq('id', selectedSlot.id);
      if (slotError) throw slotError;

      setCurrentView(UserView.SUCCESS);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const [activeTab, setActiveTab] = useState<'home' | 'search' | 'history' | 'profile'>('home');

  const CATEGORIES = [
    { id: 'all', name: 'All', icon: Zap },
    { id: 'mall', name: 'Malls', icon: MapPin },
    { id: 'airport', name: 'Airports', icon: Zap },
    { id: 'office', name: 'Offices', icon: ShieldCheck },
    { id: 'hospital', name: 'Hospitals', icon: CheckCircle2 }
  ];

  const [activeCategory, setActiveCategory] = useState('all');

  const getFilteredByCategory = () => {
    if (activeCategory === 'all') return filteredLocations;
    return filteredLocations.filter(loc => loc.address.toLowerCase().includes(activeCategory.toLowerCase()) || loc.name.toLowerCase().includes(activeCategory.toLowerCase()));
  };

  const renderHome = () => (
    <div className="space-y-8 pb-24">
      {/* Search Header */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-surface-muted">Find your best</h2>
            <h1 className="text-3xl font-black text-surface-text tracking-tight">Parking Spot</h1>
          </div>
          <button 
            onClick={() => alert('Notifications feature coming soon!')}
            className="w-12 h-12 glass rounded-2xl flex items-center justify-center text-surface-text relative active:scale-95 transition-transform"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-3 right-3 w-2 h-2 bg-blue-500 rounded-full border-2 border-surface-bg"></span>
          </button>
        </div>

        <div className="flex gap-3">
          <div className="flex-1 glass rounded-2xl px-4 flex items-center gap-3">
            <Search className="w-5 h-5 text-surface-muted" />
            <input 
              placeholder="Search parking locations..." 
              className="bg-transparent border-none outline-none text-sm text-surface-text w-full py-4"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button 
            onClick={() => alert('Filter feature coming soon!')}
            className="w-14 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/20 active:scale-95 transition-transform"
          >
            <Filter className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      {/* Categories */}
      <div className="flex gap-3 overflow-x-auto hide-scrollbar -mx-6 px-6">
        {CATEGORIES.map((cat) => (
          <button 
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl whitespace-nowrap transition-all border ${
              activeCategory === cat.id 
                ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-600/30' 
                : 'glass border-surface-border text-surface-muted hover:text-surface-text'
            }`}
          >
            <cat.icon className="w-4 h-4" />
            <span className="text-sm font-bold tracking-tight">{cat.name}</span>
          </button>
        ))}
      </div>

      {/* Featured / Nearby */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-surface-text tracking-tight">Nearby Parking</h3>
          <button 
            onClick={() => { setActiveTab('search'); setCurrentView(UserView.LOCATIONS); }} 
            className="text-xs font-bold text-blue-500 uppercase tracking-widest"
          >
            See All
          </button>
        </div>
        
        <div className="grid grid-cols-1 gap-4">
          {getFilteredByCategory().slice(0, 3).map((loc, i) => (
            <motion.div
              key={loc.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              onClick={() => { setSelectedLocation(loc); setCurrentView(UserView.SLOTS); }}
              className="group glass rounded-[32px] p-2 pr-4 flex gap-4 cursor-pointer hover:bg-surface-border/5 transition-all overflow-hidden"
            >
              <div className="w-28 h-28 bg-surface-card rounded-3xl overflow-hidden relative">
                <img 
                  src={`https://images.unsplash.com/photo-1573348722427-f1d6819fdf98?q=80&w=800&auto=format&fit=crop`} 
                  alt={loc.name}
                  className="w-full h-full object-cover opacity-60 group-hover:scale-110 transition-transform duration-500 shadow-inner"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-surface-bg/80 to-transparent"></div>
                <div className="absolute bottom-2 left-2 flex items-center gap-1">
                  <div className="p-1 px-2 bg-blue-600 rounded-lg text-[9px] font-black text-white">$4.50/hr</div>
                </div>
              </div>
              <div className="flex-1 py-3 flex flex-col justify-between">
                <div>
                  <h4 className="text-lg font-black text-surface-text leading-tight group-hover:text-blue-400 transition-colors">{loc.name}</h4>
                  <div className="flex items-center gap-1 text-surface-muted mt-1">
                    <MapPin className="w-3 h-3" />
                    <span className="text-[10px] font-bold uppercase tracking-tighter truncate max-w-[120px]">{loc.address}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                         <ShieldCheck className="w-3 h-3 text-emerald-500" />
                         <span className="text-[10px] text-emerald-500 font-bold tracking-tight">Active</span>
                      </div>
                      <span className="text-surface-border font-mono text-[10px]">|</span>
                      <div className="text-[10px] text-surface-muted font-bold uppercase">100+ Slots</div>
                   </div>
                   <div className="w-8 h-8 rounded-full bg-blue-600/10 flex items-center justify-center text-blue-500 group-hover:bg-blue-600 group-hover:text-white transition-all">
                      <ChevronRight className="w-4 h-4" />
                   </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
      
      {/* Stats Quick Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="glass rounded-[32px] p-6 space-y-4">
           <div className="p-3 bg-blue-600/10 text-blue-500 rounded-2xl w-fit">
              <Zap className="w-5 h-5" />
           </div>
           <div>
              <h5 className="text-2xl font-black text-surface-text">4.2k</h5>
              <p className="text-[10px] text-surface-muted font-bold uppercase tracking-widest mt-1">Available Nodes</p>
           </div>
        </div>
        <div className="glass rounded-[32px] p-6 space-y-4">
           <div className="p-3 bg-emerald-600/10 text-emerald-500 rounded-2xl w-fit">
              <History className="w-5 h-5" />
           </div>
           <div>
              <h5 className="text-2xl font-black text-surface-text">{activeBookings.length}</h5>
              <p className="text-[10px] text-surface-muted font-bold uppercase tracking-widest mt-1">Total Bookings</p>
           </div>
        </div>
      </div>
    </div>
  );

  const renderProfile = () => (
    <div className="space-y-8 pb-32">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-surface-text tracking-tight">Your Profile</h2>
        <button 
          onClick={async () => { await supabase.auth.signOut(); window.location.reload(); }}
          className="w-10 h-10 glass rounded-xl flex items-center justify-center text-red-500 active:scale-95 transition-transform"
        >
           <Zap className="w-4 h-4 rotate-180" />
        </button>
      </div>

      <div className="glass rounded-[40px] p-10 text-center">
        <div className="flex justify-center gap-4 mb-8">
            <button 
              onClick={() => setIsDarkMode(true)}
              className={`flex-1 py-4 rounded-2xl flex items-center justify-center gap-2 border transition-all ${isDarkMode ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-600/30' : 'glass border-surface-border text-surface-muted hover:text-surface-text'}`}
            >
              <Moon className="w-4 h-4" /> Dark
            </button>
            <button 
              onClick={() => setIsDarkMode(false)}
              className={`flex-1 py-4 rounded-2xl flex items-center justify-center gap-2 border transition-all ${!isDarkMode ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-600/30' : 'glass border-surface-border text-surface-muted hover:text-surface-text'}`}
            >
              <Sun className="w-4 h-4" /> Light
            </button>
        </div>
        <div className="w-32 h-32 bg-surface-card rounded-[50px] mx-auto mb-6 p-1 border-2 border-blue-500/30 overflow-hidden">
           <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${profile?.uid}`} alt="Profile large" className="w-full h-full object-cover" />
        </div>
        <h3 className="text-2xl font-black text-surface-text">{profile?.full_name || 'Parking Master'}</h3>
        <p className="text-[10px] text-surface-muted font-bold uppercase tracking-[0.3em] mt-1">{profile?.email || 'pune_node_user_77'}</p>
        
        <div className="mt-10 grid grid-cols-1 gap-3">
          {[
            { label: 'Edit Profile', icon: ShieldCheck },
            { label: 'Payment Methods', icon: CreditCard },
            { label: 'App Settings', icon: Filter },
            { label: 'Help Center', icon: Zap }
          ].map((item, i) => (
            <button key={i} className="w-full glass rounded-2xl p-5 flex items-center justify-between group active:scale-[0.98] transition-all">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-surface-card rounded-xl flex items-center justify-center text-surface-muted group-hover:text-blue-400 transition-colors">
                  <item.icon className="w-5 h-5" />
                </div>
                <span className="text-sm font-bold text-surface-muted group-hover:text-surface-text">{item.label}</span>
              </div>
              <ChevronRight className="w-4 h-4 text-surface-border group-hover:text-blue-500" />
            </button>
          ))}
        </div>

        <button 
          onClick={async () => { await supabase.auth.signOut(); window.location.reload(); }}
          className="w-full mt-10 py-5 bg-red-600/10 border border-red-500/20 text-red-500 font-black uppercase text-[10px] tracking-widest rounded-3xl hover:bg-red-600 hover:text-white transition-all active:scale-95"
        >
          Deactivate Node Session
        </button>
      </div>
    </div>
  );

  const BottomNav = () => (
    <div className="fixed bottom-6 left-6 right-6 h-20 glass-dark rounded-[40px] px-8 flex items-center justify-between z-50">
      <button 
        onClick={() => { setActiveTab('home'); setCurrentView(UserView.MAIN); }}
        className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'home' && currentView === UserView.MAIN ? 'text-blue-500' : 'text-surface-muted hover:text-surface-text'}`}
      >
        <Home className="w-6 h-6" />
        {activeTab === 'home' && currentView === UserView.MAIN && <motion.span layoutId="nav-dot" className="w-1.5 h-1.5 bg-blue-500 rounded-full" />}
      </button>
      <button 
        onClick={() => { setActiveTab('search'); setCurrentView(UserView.LOCATIONS); }}
        className={`flex flex-col items-center gap-1 transition-all ${currentView === UserView.LOCATIONS ? 'text-blue-500' : 'text-surface-muted hover:text-surface-text'}`}
      >
        <Search className="w-6 h-6" />
        {currentView === UserView.LOCATIONS && <motion.span layoutId="nav-dot" className="w-1.5 h-1.5 bg-blue-500 rounded-full" />}
      </button>
      <button 
        onClick={() => { setActiveTab('history'); setCurrentView(UserView.HISTORY); }}
        className={`flex flex-col items-center gap-1 transition-all ${currentView === UserView.HISTORY ? 'text-blue-500' : 'text-surface-muted hover:text-surface-text'}`}
      >
        <History className="w-6 h-6" />
        {currentView === UserView.HISTORY && <motion.span layoutId="nav-dot" className="w-1.5 h-1.5 bg-blue-500 rounded-full" />}
      </button>
      <button 
        onClick={() => { setActiveTab('profile'); setCurrentView(UserView.PROFILE); }}
        className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'profile' && currentView === UserView.PROFILE ? 'text-blue-500' : 'text-surface-muted hover:text-surface-text'}`}
      >
        <div className={`w-7 h-7 bg-surface-card rounded-full border-2 overflow-hidden transition-all ${activeTab === 'profile' && currentView === UserView.PROFILE ? 'border-blue-500' : 'border-transparent'}`}>
           <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${profile?.uid}`} alt="Profile" />
        </div>
        {activeTab === 'profile' && currentView === UserView.PROFILE && <motion.span layoutId="nav-dot" className="w-1.5 h-1.5 bg-blue-500 rounded-full" />}
      </button>
    </div>
  );

  const renderLocations = () => (
    <div className="space-y-8 pb-24">
      <div className="flex items-center gap-4">
        <button onClick={() => setCurrentView(UserView.MAIN)} className="w-10 h-10 glass rounded-xl flex items-center justify-center text-surface-muted">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-bold text-surface-text tracking-tight">Explore Locations</h2>
      </div>

      <div className="glass rounded-2xl px-4 flex items-center gap-3">
        <Search className="w-5 h-5 text-surface-muted" />
        <input 
          placeholder="Search by mall name or area..." 
          className="bg-transparent border-none outline-none text-sm text-surface-text w-full py-4 placeholder:text-surface-muted/50"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredLocations.map((loc, i) => (
          <motion.div
            key={loc.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => { setSelectedLocation(loc); setCurrentView(UserView.SLOTS); }}
            className="group glass rounded-3xl p-6 flex items-center justify-between cursor-pointer hover:bg-surface-border/5 transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-blue-600/10 rounded-2xl flex items-center justify-center text-blue-500 group-hover:bg-blue-600 group-hover:text-white transition-all">
                <MapPin className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-surface-text group-hover:text-blue-400 transition-colors">{loc.name}</h3>
                <p className="text-[10px] text-surface-muted font-bold uppercase tracking-tight mt-0.5 truncate max-w-[150px]">{loc.address}</p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className="text-[10px] font-black text-blue-500 bg-blue-500/10 px-2 py-1 rounded-lg">$4.50</span>
              <ChevronRight className="w-4 h-4 text-surface-border" />
            </div>
          </motion.div>
        ))}

        {locations.length === 0 && !loading && (
          <div className="col-span-full py-20 text-center border-2 border-dashed border-surface-border rounded-[40px]">
            <Zap className="w-12 h-12 text-surface-muted/20 mx-auto mb-6 animate-pulse" />
            <p className="text-xs font-mono uppercase tracking-[0.3em] text-surface-muted mb-8">Grid is empty. Syncing with central node...</p>
            <div className="flex flex-col items-center gap-4">
              <button 
                onClick={seedMalls}
                className="px-8 py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all shadow-xl shadow-blue-600/20"
              >
                Force Grid Synchronization
              </button>
              <p className="text-[8px] text-surface-muted/50 font-mono">NODE_HASH: PUNE_SECURE_772</p>
            </div>
          </div>
        )}

        {locations.length > 0 && filteredLocations.length === 0 && (
          <div className="col-span-full py-20 text-center">
            <Search className="w-12 h-12 text-surface-muted/20 mx-auto mb-6" />
            <p className="text-xs font-mono uppercase tracking-[0.3em] text-surface-muted">No node matches your query</p>
          </div>
        )}

        {loading && (
          <div className="col-span-full py-20 text-center">
            <div className="relative w-16 h-16 mx-auto mb-6">
              <div className="absolute inset-0 border-4 border-blue-600/10 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p className="text-xs font-mono uppercase tracking-[0.3em] text-blue-500 animate-pulse">Synchronizing Global Grid...</p>
          </div>
        )}

        {error && (
          <div className="col-span-full p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-center">
            <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest">{error}</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderSlots = () => {
    const sections = ["A", "B", "C", "D"];

    return (
      <div className="space-y-8 pb-32">
        <div className="flex items-center gap-4">
          <button onClick={() => { setSelectedLocation(null); setSelectedLevel(null); setCurrentView(UserView.LOCATIONS); }} className="w-10 h-10 glass rounded-xl flex items-center justify-center text-surface-muted">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-surface-text tracking-tight">{selectedLocation?.name}</h2>
            <p className="text-[10px] text-blue-500 font-bold uppercase tracking-widest">{selectedLocation?.address}</p>
          </div>
        </div>

        <div className="glass rounded-[40px] p-6 space-y-8">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-surface-text">Select Floor</span>
              <div className="flex items-center gap-2">
                 <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                 <span className="text-[10px] text-surface-muted font-bold uppercase">Live Availability</span>
              </div>
            </div>
            <div className="flex gap-2 overflow-x-auto hide-scrollbar">
              {selectedLocation?.levels?.map(level => (
                <button
                  key={level}
                  onClick={() => { setSelectedLevel(level); setSelectedSlot(null); }}
                  className={`px-6 py-3 rounded-2xl text-xs font-bold transition-all border whitespace-nowrap
                    ${selectedLevel === level ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-600/30' : 'glass border-surface-border text-surface-muted hover:text-surface-text'}`}
                >
                  {level} Floor
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
               <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                     <div className="w-3 h-3 bg-surface-card border border-surface-border rounded-sm text-surface-text flex items-center justify-center text-[8px] font-black opacity-30">X</div>
                     <span className="text-[10px] text-surface-muted font-bold uppercase">Taken</span>
                  </div>
                  <div className="flex items-center gap-2">
                     <div className="w-3 h-3 bg-blue-600 rounded-sm"></div>
                     <span className="text-[10px] text-surface-muted font-bold uppercase">Selected</span>
                  </div>
               </div>
            </div>

            <div className="space-y-10">
              {sections.map(section => {
                const sectionSlots = slots.filter(s => s.section === section).sort((a,b) => a.slotNumber.localeCompare(b.slotNumber));
                if (sectionSlots.length === 0) return null;

                return (
                  <div key={section} className="space-y-4">
                    <h3 className="text-[11px] font-black text-surface-muted/40 uppercase tracking-[0.3em]">Sector {section}</h3>
                    <div className="grid grid-cols-4 gap-3">
                      {sectionSlots.map(slot => (
                        <button
                          key={slot.id}
                          disabled={!slot.isAvailable}
                          onClick={() => setSelectedSlot(slot)}
                          className={`h-16 rounded-2xl flex flex-col items-center justify-center transition-all border
                            ${!slot.isAvailable ? 'bg-surface-card border-surface-border text-surface-muted/20 cursor-not-allowed' : 
                              selectedSlot?.id === slot.id ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-600/30 rotate-3 scale-105 z-10' : 
                              'glass border-surface-border text-surface-muted hover:border-blue-500/30 hover:text-surface-text shadow-sm'}`}
                        >
                          <span className="text-[10px] uppercase font-black tracking-tighter opacity-40">{section}</span>
                          <span className="text-sm font-black">{slot.slotNumber.split('-').pop()?.replace(section, '')}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {selectedSlot && (
            <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} className="pt-6 border-t border-surface-border space-y-6">
               <div className="flex items-center justify-between">
                  <div>
                     <p className="text-[10px] text-surface-muted font-bold uppercase tracking-widest">Selected Spot</p>
                     <h4 className="text-2xl font-black text-surface-text">#{selectedSlot.slotNumber}</h4>
                  </div>
                  <div className="text-right">
                     <p className="text-[10px] text-surface-muted font-bold uppercase tracking-widest">Price / hr</p>
                     <p className="text-2xl font-black text-blue-500">$4.50</p>
                  </div>
               </div>
               <button 
                 onClick={() => setCurrentView(UserView.PAYMENT)}
                 className="w-full py-5 bg-blue-600 text-white font-black uppercase text-sm tracking-[0.1em] rounded-3xl hover:bg-blue-500 transition-all shadow-xl shadow-blue-900/40 active:scale-95"
               >
                 Confirm and Pay
               </button>
            </motion.div>
          )}
        </div>
      </div>
    );
  };

  const renderPayment = () => (
    <div className="space-y-8 pb-24">
      <div className="flex items-center gap-4">
        <button onClick={() => setCurrentView(UserView.SLOTS)} className="w-10 h-10 glass rounded-xl flex items-center justify-center text-surface-muted">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-bold text-surface-text tracking-tight">Payment</h2>
      </div>

      <div className="glass rounded-[40px] p-8 space-y-8">
        <div className="p-6 glass border-blue-500/20 rounded-3xl flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-600/30">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-surface-text uppercase tracking-tight">Total Payment</h3>
            <p className="text-2xl font-black text-blue-500">$13.50 <span className="text-xs text-surface-muted font-medium">/ 3 Hours</span></p>
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-xs font-black text-surface-muted uppercase tracking-widest pl-2">Select Method</p>
          <div className="flex gap-3">
            {['card', 'upi'].map((method) => (
              <button 
                key={method}
                onClick={() => setPaymentMethod(method as any)}
                className={`flex-1 py-5 rounded-2xl border text-sm font-black uppercase transition-all flex items-center justify-center gap-3
                  ${paymentMethod === method ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-600/30' : 'glass border-surface-border text-surface-muted'}`}
              >
                {method === 'card' ? <CreditCard className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
                {method}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
           <input 
            placeholder="CARD HOLDER NAME" 
            className="w-full glass border-surface-border p-5 rounded-2xl text-xs font-bold outline-none focus:border-blue-500 transition-colors uppercase text-surface-text placeholder:text-surface-muted/30" 
           />
           <input 
            placeholder="0000 0000 0000 0000" 
            className="w-full glass border-surface-border p-5 rounded-2xl text-xs font-bold outline-none focus:border-blue-500 transition-colors uppercase text-surface-text placeholder:text-surface-muted/30 font-mono" 
           />
           <div className="grid grid-cols-2 gap-4">
             <input placeholder="MM / YY" className="w-full glass border-surface-border p-5 rounded-2xl text-xs font-bold outline-none focus:border-blue-500 transition-colors text-surface-text placeholder:text-surface-muted/30" />
             <input placeholder="CVV" type="password" className="w-full glass border-surface-border p-5 rounded-2xl text-xs font-bold outline-none focus:border-blue-500 transition-colors text-surface-text placeholder:text-surface-muted/30" />
           </div>
        </div>

        <button 
          disabled={loading}
          onClick={handleProcessPayment}
          className="w-full py-5 bg-blue-600 text-white font-black uppercase text-sm tracking-[0.1em] rounded-3xl hover:bg-blue-500 transition-all shadow-xl shadow-blue-900/40 active:scale-95 disabled:opacity-50"
        >
          {loading ? 'Processing Payment...' : 'Pay Now'}
        </button>

        <div className="flex items-center justify-center gap-2 text-surface-muted/40">
           <ShieldCheck className="w-4 h-4" />
           <span className="text-[10px] font-bold uppercase tracking-widest">Secure 256-bit SSL Encryption</span>
        </div>
      </div>
    </div>
  );

  const renderSuccess = () => {
    const sorted = [...activeBookings].sort((a,b) => {
        const aTime = new Date(a.createdAt).getTime();
        const bTime = new Date(b.createdAt).getTime();
        return bTime - aTime;
    });
    const latest = sorted[0];
    
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, rotate: -5 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        className="space-y-8 pb-32 pt-10"
      >
        <div className="glass rounded-[50px] p-10 text-center relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-blue-600/20 to-transparent pointer-events-none" />
          
          <div className="w-20 h-20 bg-emerald-500 text-black rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-[0_20px_40px_rgba(16,185,129,0.3)] rotate-12">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <h1 className="text-4xl font-black text-surface-text tracking-tight mb-2">Successfully!</h1>
          <p className="text-surface-muted text-sm font-medium uppercase tracking-[0.2em] mb-12">Parking Slot Reserved</p>

          <div className="relative group perspective-1000">
            <div className="p-8 bg-white rounded-[40px] inline-block shadow-2xl relative z-10 border border-surface-border">
              {latest && <QRCodeSVG value={latest.qrData} size={180} />}
            </div>
            <div className="absolute -inset-4 bg-blue-600/20 blur-3xl -z-10 group-hover:bg-blue-600/30 transition-all"></div>
          </div>

          <div className="mt-12 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 glass rounded-2xl text-left">
                <p className="text-[10px] text-surface-muted font-bold uppercase tracking-widest">Spot</p>
                <p className="text-lg font-black text-surface-text mt-1">#{selectedSlot?.slotNumber}</p>
              </div>
              <div className="p-4 glass rounded-2xl text-left">
                <p className="text-[10px] text-surface-muted font-bold uppercase tracking-widest">Floor</p>
                <p className="text-lg font-black text-surface-text mt-1">{selectedLevel}</p>
              </div>
            </div>

            <button 
              onClick={() => setCurrentView(UserView.MAIN)} 
              className="w-full py-4 glass border border-surface-border rounded-2xl text-xs font-black uppercase tracking-widest text-surface-text hover:bg-blue-600 hover:text-white transition-all shadow-sm"
            >
              Back to Home
            </button>
          </div>
        </div>
      </motion.div>
    );
  };

  const renderHistory = () => (
    <div className="space-y-8 pb-32">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-surface-text tracking-tight">Booking History</h2>
        <button className="w-10 h-10 glass rounded-xl flex items-center justify-center text-surface-muted">
           <Filter className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {activeBookings.length > 0 ? activeBookings.map((book, i) => (
          <motion.div 
            key={book.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            className="glass rounded-[32px] p-6 flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${book.status === 'active' ? 'bg-blue-600/10 text-blue-500' : 'bg-surface-card text-surface-muted'}`}>
                <QrIcon className="w-6 h-6" />
              </div>
              <div className="text-left">
                <p className="font-bold text-surface-text leading-tight">Booking #{book.id.slice(0,6)}</p>
                <div className="flex items-center gap-2 text-[10px] font-bold text-surface-muted uppercase tracking-tighter mt-1">
                   <span>{new Date(book.startTime).toLocaleDateString()}</span>
                   <span className="w-1 h-1 bg-surface-border rounded-full" />
                   <span className={book.status === 'active' ? 'text-blue-500' : ''}>{book.status === 'active' ? 'Active' : 'Expired'}</span>
                </div>
              </div>
            </div>
            
            {book.status === 'active' && (
               <button 
                onClick={() => {
                  setSelectedLocation(locations.find(l => l.id === book.locationId) || null);
                  setCurrentView(UserView.SUCCESS);
                }}
                className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            )}
          </motion.div>
        )) : (
          <div className="py-20 text-center glass rounded-[40px] border-dashed border-surface-border">
             <History className="w-12 h-12 text-surface-muted/20 mx-auto mb-4" />
             <p className="text-sm font-bold text-surface-muted uppercase tracking-widest">No bookings yet</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen pt-24 px-6 md:px-12 pb-20 overflow-x-hidden font-sans">
      <AnimatePresence mode="wait">
        <motion.div
           key={currentView}
           initial={{ opacity: 0, y: 30, filter: 'blur(10px)' }}
           animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
           exit={{ opacity: 0, y: -30, filter: 'blur(10px)' }}
           transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          {currentView === UserView.MAIN && renderHome()}
          {currentView === UserView.LOCATIONS && renderLocations()}
          {currentView === UserView.SLOTS && renderSlots()}
          {currentView === UserView.PAYMENT && renderPayment()}
          {currentView === UserView.SUCCESS && renderSuccess()}
          {currentView === UserView.HISTORY && renderHistory()}
          {currentView === UserView.PROFILE && renderProfile()}
        </motion.div>
      </AnimatePresence>

      {(currentView === UserView.MAIN || currentView === UserView.LOCATIONS || currentView === UserView.HISTORY || currentView === UserView.PROFILE) && <BottomNav />}
    </div>
  );
}
